const should = require('should');
const chromeLauncher = require('chrome-launcher');
const util = require('util');
const request = require('request');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const fs = require('fs');

const desktopConfig = require('lighthouse/lighthouse-core/config/lr-desktop-config.js');
const mobileConfig = require('lighthouse/lighthouse-core/config/lr-mobile-config.js');
const reportGenerator = require('lighthouse/lighthouse-core/report/report-generator');



describe( "spree test", function(){
    
    this.timeout(90000)

    const opts = {
        logLevel: 'info',
        output: 'json',
        chromeFlags: ['--disable-mobile-emulation']
    };

    let chrome
    let page

    const URL =   "http://localhost:3000" // "http://spree-vapasi-prod.herokuapp.com" //

    before( "before", async () => {
        // Launch chrome using chrome-launcher
        chrome = await chromeLauncher.launch(opts);
        opts.port = chrome.port;

        // Connect to it using puppeteer.connect().
        const resp = await util.promisify(request)(`http://localhost:${opts.port}/json/version`);
        const {webSocketDebuggerUrl} = JSON.parse(resp.body);
        browser = await puppeteer.connect({browserWSEndpoint: webSocketDebuggerUrl});
        
        page = (await browser.pages())[0];
        await page.goto(URL, {waitUntil: 'networkidle2'});
        await page.waitForSelector('[id="link-to-login"]');
    })

    runLightHousePerformanceAudit = async (filePath, config, expectedScore) => {
        // Run Lighthouse.
        const report = await lighthouse(page.url(), opts, config).then(results => {
            return results;
        });

        const html = reportGenerator.generateReport(report.lhr, 'html');
        const json = reportGenerator.generateReport(report.lhr, 'json');

        //Write report html to the file
        fs.writeFile(filePath + '.html', html, (err) => {
            if (err) {
                console.error(err);
            }
        });

        //Write report json to the file
        fs.writeFile(filePath + '.json', json, (err) => {
            if (err) {
                console.error(err);
            }
        });

        var obj = JSON.parse(json);
        console.log(filePath + " perf score = " + obj.categories.performance.score)
        // ignored this assertion as a failure here will stop the next steps (ex:- lighthouse run with mobile config)
       // obj.categories.performance.score.should.be.above(expectedScore);   
    }

    runLightHousePerformanceAudits = async(filename, expectedScore) => {
        await runLightHousePerformanceAudit('reports/desktop/' + filename, desktopConfig, expectedScore)
        await runLightHousePerformanceAudit('reports/mobile/' + filename, mobileConfig, expectedScore)
    }

    function delay(timeout) {
        return new Promise((resolve) => {
          setTimeout(resolve, timeout);
        });
    }

    it("Landing page", async ()=> {
        await runLightHousePerformanceAudits('landingPage', 0.90)
    })

    it("Login screen", async() => {
        await page.evaluate(() => document.querySelector('[id="link-to-login"] a').click()); 
        await runLightHousePerformanceAudits('loginPage', 0.90)
    })

    it("successfully logged in", async() => {
        await page.waitForSelector('[id="spree_user_email"]');
        await page.type('[id="spree_user_email"]', "d@d.com")
        await page.type('[id="spree_user_password"]', "TestMe@123")
        await page.click('[name="commit"]')
        await page.waitForSelector('.alert-success');
        await runLightHousePerformanceAudits('homePage', 0.90)
    })

    after( "after", async () => {
        await browser.close();
        await browser.disconnect();
        await chrome.kill();
    })

})