import { chromium } from "playwright";
import { selectors } from '@playwright/test';

const MIN_PRICE = 100000;
const MAX_PRICE = 200000;
const LAST_PAGE = 999;
const MAX_ALTURA_ORONO = 1700
const MIN_ALTURA_ORONO = 1200
const MAX_ALTURA_PELLEGRINI = 2000
const MIN_ALTURA_PELLEGRINI = 1000
const PARALELAS_ORONO = ['españa', 'roca', 'paraguay', 'corrientes', 'rios', 'ríos', 'entre rios', 'entre ríos', 'mitre', 'sarmiento']
const PARALELAS_PELLEGRINI = ['pellegrini', 'montevideo', 'zeballos', 'julio', '3 de febrero', 'tres de febrero', 'mendoza']
const BASE_URL = 'https://www.zonaprop.com.ar'

const deptosList = []

const initBrowser = async () => {
    try{
        selectors.setTestIdAttribute('data-qa');
        const userAgent = 'Mozilla/5.0 (X11; Linux x86_64)' + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent
        });
        const page = await context.newPage();
        return { browser, page, context };
    }
    catch(e){
        console.log(e);
    }
}

const getLastPage = async () => {
    try{
        const {page, browser} = await initBrowser();
        const url = getUrl(LAST_PAGE)
        await page.goto(url);
        const lastPage = (await page.url()).split('pagina-')[1].split('.')[0]
        await browser.close();
        return lastPage;
    }
    catch(e){
        console.log(e);
    }
}

const buscarDeptos = async () => {
    const lastPage = await getLastPage();
    for (let i = 1; i <= lastPage; i++) {
    const { page, browser } = await initBrowser();
    try {
            let pageNumber = i;
            const url = getUrl(pageNumber);
            await page.goto(url);
            const deptosContainer = await page.getByTestId('posting PROPERTY').all();
            const deptosCards = await deptosContainer.map(async (depto) => {
                const price = (await depto.getByTestId('POSTING_CARD_PRICE').textContent()).replace('$ ', '');
                const address = await depto.getByTestId('POSTING_CARD_LOCATION').locator('..').locator('div').first().textContent();
                const deptoLink = await depto.getAttribute('data-to-posting')
                const link = `${BASE_URL}${deptoLink}`;
                return {
                    price,
                    address,
                    link,
                }
            })
            const deptos = await Promise.all(deptosCards);
            deptosList.push(...deptos);
        } finally {
            await browser.close();
        }
    }

    const enElRangoDeParalelasAOrono = (depto) => PARALELAS_ORONO.some(paralela => depto.address.toLowerCase().includes(paralela))
    const enElRangoDeParalelasAPellegrini = (depto) => PARALELAS_PELLEGRINI.some(paralela => depto.address.toLowerCase().includes(paralela))
    const enElRangoDeAlturasOrono = (depto) => PARALELAS_ORONO.some(paralela => depto.address.toLowerCase().includes(paralela)) && depto.address.split(' ').some(word => word > MIN_ALTURA_ORONO && word < MAX_ALTURA_ORONO) 
    const enElRangoDeAlturasPellegrini = (depto) => PARALELAS_PELLEGRINI.some(paralela => depto.address.toLowerCase().includes(paralela)) && depto.address.split(' ').some(word => word > MIN_ALTURA_PELLEGRINI && word < MAX_ALTURA_PELLEGRINI)
    const deptos = deptosList.filter(depto => enElRangoDeAlturasOrono(depto) || enElRangoDeAlturasPellegrini(depto) || (enElRangoDeParalelasAOrono(depto) && enElRangoDeParalelasAPellegrini(depto)));
    console.table(deptos)
}

const getUrl = (page) => {
    return `${BASE_URL}/departamentos-alquiler-distrito-centro-${MIN_PRICE}-${MAX_PRICE}-pesos-orden-publicado-descendente-pagina-${page}.html`
}
buscarDeptos();
