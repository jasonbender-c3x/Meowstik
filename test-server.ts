
import express from 'express';
import playwrightRouter from './server/routes/playwright';

const app = express();
app.use(express.json());

app.use('/api/playwright', playwrightRouter);

app.get('/api/health', (req, res) => res.json({ status: 'alive' }));

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
