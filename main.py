import sqlite3
from flask import Flask, jsonify, request, g
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DATABASE = 'pulsepay.db'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                amount REAL NOT NULL,
                type TEXT NOT NULL,
                date TEXT NOT NULL
            )
        ''')
        db.commit()

init_db()

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    db = get_db()
    cursor = db.execute('SELECT * FROM transactions ORDER BY date DESC')
    rows = cursor.fetchall()
    return jsonify([dict(row) for row in rows])

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    data = request.get_json()
    db = get_db()
    try:
        db.execute(
            'INSERT INTO transactions (id, name, amount, type, date) VALUES (?, ?, ?, ?, ?)',
            (data['id'], data['name'], data['amount'], data['type'], data['date'])
        )
        db.commit()
        return jsonify({"status": "success", "transaction": data}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
