import { spawn } from 'child_process';
import path from 'path';
import pg from 'pg';

export interface DatabaseAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ rowCount: number; lastInsertId?: number }>;
}

class PostgresAdapter implements DatabaseAdapter {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ rowCount: number; lastInsertId?: number }> {
    const res = await this.pool.query(sql, params);
    return { rowCount: res.rowCount || 0 };
  }
}

class SqlitePythonAdapter implements DatabaseAdapter {
  private dbPath: string;

  constructor(dbPath: string = 'federated_learning.db') {
    this.dbPath = path.resolve(process.cwd(), dbPath);
  }

  private runPythonSql(action: 'query' | 'execute', sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({ db_path: this.dbPath, action, sql, params });
      
      const pyCode = `
import sys, json, sqlite3

try:
    data = json.loads(sys.stdin.read())
    conn = sqlite3.connect(data["db_path"])
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    sql = data["sql"]
    params = data.get("params", [])
    
    # Convert PostgreSQL style $1, $2 to SQLite ? placeholders if present
    import re
    sqlite_sql = re.sub(r'\\$(\\d+)', '?', sql)
    
    cur.execute(sqlite_sql, params)
    
    if data["action"] == "query":
        rows = [dict(r) for r in cur.fetchall()]
        print(json.dumps({"success": True, "rows": rows}))
    else:
        conn.commit()
        print(json.dumps({
            "success": True, 
            "rowCount": cur.rowcount,
            "lastInsertId": cur.lastrowid
        }))
    conn.close()
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

      const child = spawn('python3', ['-c', pyCode], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Database bridge process failed with code ${code}: ${stderr}`));
        }
        try {
          const res = JSON.parse(stdout.trim());
          if (!res.success) {
            return reject(new Error(res.error || 'Database operation failed'));
          }
          if (action === 'query') {
            resolve(res.rows);
          } else {
            resolve({ rowCount: res.rowCount, lastInsertId: res.lastInsertId });
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse database output: ${stdout || stderr} (${e.message})`));
        }
      });

      child.stdin.write(payload);
      child.stdin.end();
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.runPythonSql('query', sql, params);
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ rowCount: number; lastInsertId?: number }> {
    return this.runPythonSql('execute', sql, params);
  }
}

// Factory to select active adapter based on DATABASE_URL
const dbUrl = process.env.DATABASE_URL || '';
export const db: DatabaseAdapter =
  dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')
    ? new PostgresAdapter(dbUrl)
    : new SqlitePythonAdapter('federated_learning.db');
