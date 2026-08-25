import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DOCUMENTS_DIR = path.resolve('documentos');
const OUTPUT_JSON_PATH = path.resolve('src/pdfKnowledgeBase.json');

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST || 'dpg-da6gej942hec73d10fa0-a.oregon-postgres.render.com',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'vixertst',
  user: process.env.PGUSER || 'vixertst_user',
  password: process.env.PGPASSWORD || '6or1kOJXLiH5IdubuuqYa8Yx89xnC6Yf',
  ssl: { rejectUnauthorized: false }
});

function chunkText(text, maxChunkSize = 500, overlap = 100) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex < cleanText.length) {
      // Tentar quebrar na última pontuação ou espaço
      const lastSpace = cleanText.lastIndexOf(' ', endIndex);
      if (lastSpace > startIndex + 100) {
        endIndex = lastSpace;
      }
    } else {
      endIndex = cleanText.length;
    }

    const chunkStr = cleanText.substring(startIndex, endIndex).trim();
    if (chunkStr.length > 30) {
      chunks.push(chunkStr);
    }

    startIndex = endIndex - overlap;
    if (startIndex >= cleanText.length || endIndex >= cleanText.length) {
      break;
    }
  }

  return chunks;
}

async function indexPDFs() {
  console.log('Iniciando indexação dos arquivos PDF em:', DOCUMENTS_DIR);

  if (!fs.existsSync(DOCUMENTS_DIR)) {
    console.error('Diretório de documentos não encontrado!');
    return;
  }

  const files = fs.readdirSync(DOCUMENTS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Encontrados ${files.length} arquivos PDF para indexação.`);

  // Criar tabela no PostgreSQL
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS pdf_chunks (
        id VARCHAR(255) PRIMARY KEY,
        document_title VARCHAR(255) NOT NULL,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    console.log('Tabela "pdf_chunks" pronta no PostgreSQL.');
  } catch (err) {
    console.warn('Aviso DB:', err.message);
  }

  const allDocuments = [];

  for (const filename of files) {
    const filePath = path.join(DOCUMENTS_DIR, filename);
    console.log(`Lendo: ${filename}...`);

    try {
      const dataBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(dataBuffer);
      const parser = new PDFParse(uint8Array);
      const parsedRes = await parser.getText();
      
      const text = typeof parsedRes === 'string' ? parsedRes : (parsedRes.text || '');
      const chunks = chunkText(text, 600, 100);

      const docRecord = {
        title: filename,
        chunksCount: chunks.length,
        chunks: chunks
      };

      allDocuments.push(docRecord);

      // Salvar no PostgreSQL se disponível
      try {
        const client = await pool.connect();
        await client.query('DELETE FROM pdf_chunks WHERE document_title = $1', [filename]);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = `chk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          await client.query(
            'INSERT INTO pdf_chunks (id, document_title, chunk_index, content) VALUES ($1, $2, $3, $4)',
            [chunkId, filename, i, chunks[i]]
          );
        }
        client.release();
      } catch (dbErr) {
        // ignora se DB offline
      }

      console.log(`✔ Indexado ${filename} (${chunks.length} trechos).`);
      // Salvar JSON incrementalmente
      fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(allDocuments, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Erro ao ler ${filename}:`, err.message);
    }
  }

  console.log(`\n🎉 Sucesso! Concluída a indexação de ${allDocuments.length} PDFs.`);
  console.log(`Salvo base de conhecimento em: ${OUTPUT_JSON_PATH}`);

  process.exit(0);
}

indexPDFs();
