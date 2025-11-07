import puppeteer from 'puppeteer';

async function testPuppeteer() {
  console.log('Starting Puppeteer test...');
  
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: '/home/ubuntu/.cache/puppeteer/chrome/linux-142.0.7444.61/chrome-linux64/chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    
    console.log('Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('New page created');
    
    await page.setViewport({
      width: 1620,
      height: 2160,
      deviceScaleFactor: 2,
    });
    console.log('Viewport set');
    
    const url = 'https://3000-iw9gao2tir8aow26jvqcg-35b56bea.manus.computer/';
    console.log(`Navigating to: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    
    console.log('Page loaded successfully');
    
    const pdf = await page.pdf({
      width: '1620px',
      height: '2160px',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    
    console.log(`PDF generated: ${pdf.length} bytes`);
    
    await browser.close();
    console.log('Browser closed');
    
    console.log('✅ Puppeteer test completed successfully!');
  } catch (error) {
    console.error('❌ Puppeteer test failed:');
    console.error(error);
    process.exit(1);
  }
}

testPuppeteer();
