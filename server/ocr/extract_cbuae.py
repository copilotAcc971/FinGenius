#!/usr/bin/env python3
"""
CBUAE Exchange Rates Extraction using Advanced OCR
Adds URL-based extraction capability to existing OCR pipeline
"""

import click
import json
import tempfile
import os
import sys

# Import from existing OCR engine (if available)
try:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
    from src.core.pipeline import AdvancedOCRPipeline
    HAS_PIPELINE = True
except ImportError:
    HAS_PIPELINE = False
    # Suppress warning in stderr as it will be logged
    pass

def screenshot_cbuae_table(url: str, output_path: str):
    """Take screenshot of CBUAE exchange rates table"""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    import subprocess
    
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    
    # Set Chromium binary location for Replit environment
    try:
        chromium_path = subprocess.check_output(['which', 'chromium'], text=True).strip()
        if chromium_path:
            chrome_options.binary_location = chromium_path
    except:
        pass  # Use system default if which command fails
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        driver.get(url)
        # Wait for table to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "table"))
        )
        
        # Find and screenshot the rates table
        table = driver.find_element(By.TAG_NAME, "table")
        table.screenshot(output_path)
        
        return True
    except Exception as e:
        click.echo(f"Screenshot error: {e}", err=True)
        return False
    finally:
        driver.quit()

def parse_ocr_output(text: str):
    """Parse OCR text to extract currency codes, units, and rates from CBUAE table"""
    import re
    
    rates = []
    
    # CBUAE table format: Currency Code | Unit | AED Rate
    # Example: "USD    1    3.6725" means 1 USD = 3.6725 AED
    # Example: "JPY    100    2.4567" means 100 JPY = 2.4567 AED
    
    # Pattern to match: Currency (3 letters), Unit (number), Rate (decimal)
    # More flexible pattern to handle OCR variations
    pattern = r'([A-Z]{3})\s+(\d+)\s+([\d.]+)'
    
    for match in re.finditer(pattern, text):
        currency = match.group(1)
        unit = int(match.group(2))
        aed_amount = float(match.group(3))
        
        # Normalize to rate for 1 unit of foreign currency
        # If unit is 100 (e.g., JPY), divide by 100
        # Example: 100 JPY = 2.4567 AED means 1 JPY = 0.024567 AED
        rate_per_one_unit = aed_amount / unit
        
        # Validate: must be 3-letter code and positive rate
        if len(currency) == 3 and rate_per_one_unit > 0:
            rates.append({
                'currency': currency,
                'rate': str(rate_per_one_unit),  # This is: 1 {currency} = X AED
                'unit': unit,
                'aed_amount': aed_amount
            })
    
    return rates

@click.command()
@click.option('--url', default='https://www.centralbank.ae/en/forex-eibor/exchange-rates/', help='CBUAE URL')
@click.option('--output', default='json', help='Output format')
def extract_cbuae(url, output):
    """Extract exchange rates from CBUAE website using OCR"""
    
    # Create temp file for screenshot
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        screenshot_path = tmp.name
    
    try:
        # Step 1: Screenshot the table
        click.echo(f"Capturing screenshot from {url}...", err=True)
        if not screenshot_cbuae_table(url, screenshot_path):
            click.echo("Failed to capture screenshot", err=True)
            sys.exit(1)
        
        # Step 2: Run OCR on screenshot
        click.echo("Running OCR on screenshot...", err=True)
        
        if HAS_PIPELINE:
            # Use existing Advanced OCR pipeline
            click.echo("Using Advanced OCR Pipeline", err=True)
            pipeline = AdvancedOCRPipeline()
            result = pipeline.process_image(screenshot_path)
            text = result.get('text', '')
        else:
            # Fallback: Use pytesseract directly
            click.echo("Using pytesseract fallback", err=True)
            import pytesseract
            from PIL import Image
            img = Image.open(screenshot_path)
            text = pytesseract.image_to_string(img)
        
        # Step 3: Parse rates from OCR text
        click.echo("Parsing exchange rates...", err=True)
        rates = parse_ocr_output(text)
        
        # Step 4: Output results
        if output == 'json':
            # Output to stdout as JSON (this is what Node.js will parse)
            print(json.dumps(rates, indent=2))
        else:
            for rate in rates:
                click.echo(f"{rate['currency']}: {rate['rate']}")
        
        click.echo(f"✓ Extracted {len(rates)} rates", err=True)
        
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean up temp file
        if os.path.exists(screenshot_path):
            os.remove(screenshot_path)

if __name__ == '__main__':
    extract_cbuae()
