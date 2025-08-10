app.post('/toll/calculate', (req, res) => {
  let { plazas, vehicleClass, distance_km } = req.body;

  console.log('Received toll calculate request:', { plazas, vehicleClass, distance_km });

  // Validasi dan bersihkan plazas
  if (!Array.isArray(plazas)) plazas = [];
  plazas = plazas
    .filter(p => typeof p === 'string' && p.trim().length > 0)
    .map(p => p.trim());

  if (plazas.length < 2) {
    return res.status(400).json({ error: 'Minimal dua plaza diperlukan' });
  }
  if (!vehicleClass || !VEHICLE_CLASSES[vehicleClass]) {
    return res.status(400).json({ error: 'Kelas kendaraan tidak valid' });
  }
  if (typeof distance_km !== 'number' || distance_km <= 0) {
    return res.status(400).json({ error: 'Jarak perjalanan tidak valid' });
  }

  // Pastikan VEHICLE_CLASSES punya properti name
  const vehicleType = VEHICLE_CLASSES[vehicleClass].name || 'Unknown';
  const ratePerKm = VEHICLE_CLASSES[vehicleClass].rate_per_km || 0;
  const roadCost = distance_km * ratePerKm;

  const db = new sqlite3.Database(tollDBPath);
  let totalTol = 0;
  let details = [];

  const processNext = (index) => {
    if (index >= plazas.length - 1) {
      db.close();
      const responseData = {
        totalCost: roadCost + totalTol,
        roadCost,
        tollCost: totalTol,
        details,
        vehicleType,
        vehicleClass,
        distance: distance_km,
        ratePerKm,
        estimatedTime: null
      };
      console.log('Sending toll calculate response:', responseData);
      return res.json(responseData);
    }

    const startPlaza = plazas[index];
    const endPlaza = plazas[index + 1];

    db.get(
      `SELECT * FROM toll_rates WHERE Nama_Masuk = ? AND Nama_Keluar = ?`,
      [startPlaza, endPlaza],
      (err, row) => {
        if (err) {
          console.error('Database error:', err);
          // Lanjut proses walau error, tapi beri rate 0
          details.push({
            from: startPlaza,
            to: endPlaza,
            rate: null
          });
          totalTol += 0;
          return processNext(index + 1);
        }

        let tolRate = 0;
        if (row) {
          const rate = row[`Kelas_${vehicleClass}`];
          tolRate = parseFloat(rate);
          if (isNaN(tolRate)) tolRate = 0;
        }
        totalTol += tolRate;

        details.push({
          from: startPlaza,
          to: endPlaza,
          rate: tolRate > 0 ? tolRate : null
        });

        processNext(index + 1);
      }
    );
  };

  processNext(0);
});