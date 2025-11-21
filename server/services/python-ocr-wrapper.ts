import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OCRRate {
  currency: string;
  rate: string;
}

export class PythonOCRService {
  private ocrScriptPath: string;

  constructor() {
    // Path to the Python OCR script
    this.ocrScriptPath = path.join(__dirname, '../ocr/ocr_cli.py');
  }

  async extractCBUAERates(): Promise<OCRRate[]> {
    return new Promise((resolve, reject) => {
      const targetUrl = 'https://www.centralbank.ae/en/forex-eibor/exchange-rates/';
      
      // Use the new extract_cbuae.py script
      const extractScript = path.join(__dirname, '../ocr/extract_cbuae.py');
      
      // Execute Python OCR script as subprocess
      const python = spawn('python3', [
        extractScript,
        '--url', targetUrl,
        '--output', 'json'
      ]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        // Log progress messages from Python script
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Python OCR stderr:', stderr);
          reject(new Error(`Python OCR process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output from Python script
          const result = JSON.parse(stdout);
          
          // Expected format: [{ currency: 'USD', rate: '3.6725' }, ...]
          if (!Array.isArray(result)) {
            reject(new Error('Python OCR returned invalid format'));
            return;
          }

          const rates: OCRRate[] = result.map((item: any) => ({
            currency: item.currency || item.code,
            rate: item.rate || item.value
          }));

          resolve(rates);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          reject(new Error(`Failed to parse Python OCR output: ${errorMessage}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  async checkPythonAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const python = spawn('python3', ['--version']);
      
      python.on('close', (code) => {
        resolve(code === 0);
      });
      
      python.on('error', () => {
        resolve(false);
      });
    });
  }

  async checkOCRScriptExists(): Promise<boolean> {
    // Check for extract_cbuae.py instead of ocr_cli.py
    const extractScript = path.join(__dirname, '../ocr/extract_cbuae.py');
    return fs.existsSync(extractScript);
  }
}
