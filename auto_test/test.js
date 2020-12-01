const puppeteer = require('puppeteer');
// https://stackoverflow.com/questions/25678063/whats-the-difference-between-assertion-library-testing-framework-and-testing-e#:~:text=Assertion%20libraries%20are%20tools%20to,do%20thousands%20of%20if%20statements.
const { expect }  = require('chai');
const { link } = require('promise-fs');

const prefix_s = "test_screenshot/";

let screen_shot_count = 1; 
async function screenshot(page, fileName){
    const fn = screen_shot_count + " " + fileName;
    await page.waitForTimeout(500);
    await page.screenshot({path: prefix_s + fn});
    screen_shot_count++;
}

describe('ShiguReader Render Testing', function(){

    let browser;
    let page;

    //https://github.com/mochajs/mocha/issues/2586 
    //不用arrow function
    // Passing arrow functions (aka “lambdas”) to Mocha is discouraged. Lambdas lexically bind this and cannot access the Mocha context. 
    this.timeout(30*1000);

    before(async function() {
        // runs once before the first test in this block
        browser = await puppeteer.launch({
            headless: false
        });
    });


    after(async function() {
        // runs once after the last test in this block
        await browser.close();
    });

    beforeEach(async function() {
        page = await browser.newPage();

        await page.setViewport({
            width: 1000,
            height: 2000
          });
          
    });

    afterEach(async function() {
       await page.close();
    });

    it('home and workflow', async function() {
        await page.goto("http://localhost:3000/");
        const title = await page.title();
        expect(title).to.eql('ShiguReader');
        await screenshot(page, 'home.png');

        // const links = await page.evaluate(() => {
        //          return Array.from(document.querySelectorAll('.explorer-container .dir-list a'));
        // });

        //explorer------------------------------------------------
        let links = await page.$$eval(".explorer-container .dir-list a", nodeArr => {
            return nodeArr.map(e => e.href);
        });
        expect(links.length).to.greaterThan(0);
        await page.goto(links[0]);
        await screenshot(page, 'explorer.png');

        const secPage = await browser.newPage();


        //video--------------------------------
        links = await page.$$eval(".explorer-container .video-list a", nodeArr => {
            return nodeArr.map(e => e.href);
        });
        expect(links.length).to.greaterThan(0, "video link");
        // await secPage.goto(links[0]);
        // await screenshot(secPage, 'video player.png');


        //one book------------------------------------------
        links = await page.$$eval(".explorer-container .file-cell-inner", nodeArr => {
            return nodeArr.map(e => e.href);
        });

        console.log(links)
        expect(links.length).to.greaterThan(0, "one book link");
        // for(let ii = 0; ii < links.length; ii++){
        //     await secPage.goto(link[ii]);
        //     await screenshot(secPage, `${ii}_onebook.png`);
           
        // }
        await secPage.close()
    });


    it('tag page', async function() {
        await page.goto("http://localhost:3000/tagPage/");
        await screenshot(page, 'tag page.png');


        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    });

    it('authorPage', async function() {
        await page.goto("http://localhost:3000/authorPage/");
        await screenshot(page, 'authorPage.png');

        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    });


    it('chart', async function() {
        await page.goto("http://localhost:3000/chart");
        await screenshot(page, 'chart.png');

        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    });


    it('admin', async function() {
        await page.goto("http://localhost:3000/admin");
        await screenshot(page, 'admin.png');

        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    })
});