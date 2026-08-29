use serde::Deserialize;
use serde_json::Value as Json;
use sqlx::{
    query::Query,
    sqlite::{Sqlite, SqliteArguments},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};

const DB_URL: &str = "sqlite:strand.db";

/// Migration SQL lives in /migrations so the Rust app, the browser dev build
/// and the tests all run the exact same schema.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "catalog",
            sql: include_str!("../../migrations/002_catalog.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "toilet_target",
            sql: include_str!("../../migrations/003_toilet_target.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "catalog_images",
            sql: include_str!("../../migrations/004_catalog_images.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "all_catalog_images",
            sql: include_str!("../../migrations/005_all_catalog_images.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[derive(Deserialize)]
struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<Json>,
}

fn bind<'a>(
    query: Query<'a, Sqlite, SqliteArguments<'a>>,
    value: Json,
) -> Query<'a, Sqlite, SqliteArguments<'a>> {
    match value {
        Json::Null => query.bind(None::<String>),
        Json::Bool(flag) => query.bind(flag),
        Json::String(text) => query.bind(text),
        // Every length in the model is an integer millimetre, so whole numbers
        // must not go in as floats.
        Json::Number(number) => match number.as_i64() {
            Some(int) => query.bind(int),
            None => query.bind(number.as_f64().unwrap_or_default()),
        },
        other => query.bind(other.to_string()),
    }
}

/// Applies a document write as one transaction.
///
/// The SQL plugin hands out a pooled connection per call, so a BEGIN sent from
/// the frontend is not guaranteed to reach the same connection as the
/// statements after it. Borrowing the pool from the plugin's state and driving
/// the transaction here makes a batch commit or roll back as a unit.
#[tauri::command]
async fn apply_batch(app: AppHandle, statements: Vec<Statement>) -> Result<(), String> {
    let pool = {
        let instances = app.state::<DbInstances>();
        let open = instances.0.read().await;
        match open.get(DB_URL) {
            Some(DbPool::Sqlite(pool)) => pool.clone(),
            _ => return Err(format!("database {DB_URL} is not open")),
        }
    };

    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
    for statement in statements {
        let mut query = sqlx::query(&statement.sql);
        for value in statement.params {
            query = bind(query, value);
        }
        query
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("{}: {error}", statement.sql))?;
    }
    tx.commit().await.map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![apply_batch])
        .run(tauri::generate_context!())
        .expect("error while running Strand");
}
