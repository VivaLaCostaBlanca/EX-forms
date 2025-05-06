import express from 'express';
import { exec } from 'child_process';

const app = express();
app.use(express.json());

// EX-15 trigger
app.post('/trigger-pdf', (req, res) => {
  console.log('🔔 Received trigger for NIE (EX-15)');

  exec('node email-to-pdf.js', (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Script error:', stderr);
      return res.status(500).send('Error running script');
    }

    console.log('✅ Script finished:', stdout);
    res.status(200).send('Script triggered successfully');
  });
});


// NEW: EX-18 trigger
app.post('/trigger-residency', (req, res) => {
  console.log('🔔 Received trigger for Residency (EX-18)');

  exec('node email-to-pdf-residencia.js', (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Script error:', stderr);
      return res.status(500).send('Error running script');
    }

    console.log('✅ Script finished:', stdout);
    res.status(200).send('Residency script triggered successfully');
  });
});


// NEW: EX-15-Notary trigger
app.post('/trigger-residency', (req, res) => {
  console.log('🔔 Received trigger for Residency (EX-15)');

  exec('node email-to-pdf-by-sn.js', (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Script error:', stderr);
      return res.status(500).send('Error running script');
    }

    console.log('✅ Script finished:', stdout);
    res.status(200).send('Notary script triggered successfully');
  });
});


app.listen(3000, () => {
  console.log('🚀 Listening on http://localhost:3000');
});
