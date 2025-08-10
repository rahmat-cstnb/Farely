const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose();

const dbFolder = path.join(__dirname, 'db');
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder);

// ===== 1. CREATE taxi_stands.db =====
function importTaxiStands() {
    const db = new sqlite3.Database(path.join(dbFolder, 'taxi_stands.db'));
    db.serialize(() => {
        db.run(`DROP TABLE IF EXISTS taxi_stands`);
        db.run(`
            CREATE TABLE taxi_stands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                lon REAL,
                lat REAL,
                category TEXT,
                road TEXT,
                suburb TEXT,
                city_district TEXT,
                town TEXT,
                city TEXT,
                state TEXT,
                postcode TEXT,
                country TEXT,
                operator TEXT,
                ref TEXT,
                public_transport TEXT,
                station TEXT,
                wheelchair TEXT,
                network TEXT
            )
        `);

        const stmt = db.prepare(`
            INSERT INTO taxi_stands (
                name, lon, lat, category, road, suburb, city_district,
                town, city, state, postcode, country, operator, ref,
                public_transport, station, wheelchair, network
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);

        fs.createReadStream(path.join(__dirname, 'Taxistand_my.csv'))
            .pipe(csv())
            .on('data', (row) => {
                stmt.run(
                    row.name, row.lon, row.lat, row.category, row.road, row.suburb,
                    row.city_district, row.town, row.city, row.state, row.postcode,
                    row.country, row.operator, row.ref, row.public_transport,
                    row.station, row.wheelchair, row.network
                );
            })
            .on('end', () => {
                stmt.finalize();
                console.log('✅ Taxi stands imported');
            });
    });
}

// ===== 2. CREATE toll_rates.db =====
function importTollRates() {
    const db = new sqlite3.Database(path.join(dbFolder, 'toll_rates.db'));
    db.serialize(() => {
        db.run(`DROP TABLE IF EXISTS toll_rates`);
        db.run(`
            CREATE TABLE toll_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_lebuhraya INTEGER,
                nama_lebuhraya TEXT,
                id_masuk INTEGER,
                nama_masuk TEXT,
                id_keluar INTEGER,
                nama_keluar TEXT,
                perjalanan TEXT,
                kelas1 REAL,
                kelas2 REAL,
                kelas3 REAL,
                kelas4 REAL,
                kelas5 REAL,
                jarak_km REAL,
                sistem_tol TEXT,
                status TEXT,
                source_file TEXT,
                x_masuk REAL,
                y_masuk REAL,
                x_keluar REAL,
                y_keluar REAL,
                sumber_masuk TEXT,
                sumber_keluar TEXT
            )
        `);

        const stmt = db.prepare(`
            INSERT INTO toll_rates (
                id_lebuhraya, nama_lebuhraya, id_masuk, nama_masuk, id_keluar,
                nama_keluar, perjalanan, kelas1, kelas2, kelas3, kelas4, kelas5,
                jarak_km, sistem_tol, status, source_file, x_masuk, y_masuk,
                x_keluar, y_keluar, sumber_masuk, sumber_keluar
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);

        fs.createReadStream(path.join(__dirname, 'Tariftoll_my.csv'))
            .pipe(csv())
            .on('data', (row) => {
                stmt.run(
                    row.ID_Lebuhraya, row.Nama_Lebuhraya, row.ID_Masuk, row.Nama_Masuk,
                    row.ID_Keluar, row.Nama_Keluar, row.Perjalanan, row['Kelas 1'],
                    row['Kelas 2'], row['Kelas 3'], row['Kelas 4'], row['Kelas 5'],
                    row.Jarak_KM, row.Sistem_Tol, row.Status, row.Source_File,
                    row.X_Masuk, row.Y_Masuk, row.X_Keluar, row.Y_Keluar,
                    row.Sumber_Masuk, row.Sumber_Keluar
                );
            })
            .on('end', () => {
                stmt.finalize();
                console.log('✅ Toll rates imported');
            });
    });
}

importTaxiStands();
importTollRates();