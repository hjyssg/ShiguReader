const puppeteer = require('puppeteer');
// https://stackoverflow.com/questions/25678063/whats-the-difference-between-assertion-library-testing-framework-and-testing-e#:~:text=Assertion%20libraries%20are%20tools%20to,do%20thousands%20of%20if%20statements.
const { expect }  = require('chai');


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
        // await browser.close();
    });

    beforeEach(async function() {
        page = await browser.newPage();
    });

    afterEach(async function() {
    //    await page.close();
    });

    it('home', async function() {
        await page.goto("http://localhost:3000/")
        const title = await page.title();
        expect(title).to.eql('ShiguReader');
    });


    it('tag page', async function() {
        await page.goto("http://localhost:3000/tagPage/")
        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    });

    it('authorPage', async function() {
        await page.goto("http://localhost:3000/authorPage/")
        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    });


    it('chart', async function() {
        await page.goto("http://localhost:3000/chart")
        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    });


    it('admin', async function() {
        await page.goto("http://localhost:3000/admin")
        // const title = await page.title();
        // expect(title).to.eql('ShiguReader');
    })
});