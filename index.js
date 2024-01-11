import { chromium } from "playwright-chromium";
import { selectors } from "@playwright/test";
import { config } from "dotenv";
import cron from "node-cron";
import logger from "./winston.js";
import doc from "./spreadsheet.js";

config();

const BASE_URL = process.env.BASE_URL;
const CITY = process.env.CITY;
const FILTERS = process.env.FILTERS;
const MIN_PRICE = 110000;
const MAX_PRICE = 180000;
const LAST_PAGE = 999;
const MAX_STREET_ORONO = 1700;
const MIN_STREET_ORONO = 1200;
const MAX_STREET_PELLEGRINI = 2000;
const MIN_STREET_PELLEGRINI = 1000;
const PARALELL_STREETS_ORONO = [
  "españa",
  "roca",
  "paraguay",
  "corrientes",
  "rios",
  "ríos",
  "entre rios",
  "entre ríos",
  "mitre",
  "sarmiento",
];
const PARALELL_STREETS_PELLEGRINI = [
  "pellegrini",
  "montevideo",
  "zeballos",
  "julio",
  "3 de febrero",
  "tres de febrero",
  "mendoza",
];
const apartmentsList = [];

const initBrowser = async () => {
  try {
    selectors.setTestIdAttribute("data-qa");
    const userAgent =
      "Mozilla/5.0 (X11; Linux x86_64)" +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36";
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent,
    });
    const page = await context.newPage();
    return { browser, page, context };
  } catch (e) {
    logger.error(e.message);
  }
};

const getLastPage = async () => {
  try {
    const { page, browser } = await initBrowser();
    const url = getUrl(LAST_PAGE);
    await page.goto(url);
    const lastPage = (await page.url()).split("pagina-")[1].split(".")[0];
    await browser.close();
    return lastPage;
  } catch (e) {
    logger.error(e.message);
  }
};

const searchApartments = async () => {
  try {
    const lastPage = await getLastPage();
    const promises = [];
    console.log("\x1b[32m%s\x1b[0m", "Searching for apartments");
    for (let i = 1; i <= lastPage; i++) {
      promises.push(processPage(i));
    }
    await Promise.all(promises);
  } catch (e) {
    logger.error(e.message);
  }

  const apartments = apartmentsList.filter(
    (apartment) =>
      (withinParalellStreetsRange(apartment, PARALELL_STREETS_ORONO) &&
        withinParalellStreetsRange(apartment, PARALELL_STREETS_PELLEGRINI)) ||
      withinStreetsRange(
        apartment,
        PARALELL_STREETS_ORONO,
        MIN_STREET_ORONO,
        MAX_STREET_ORONO
      ) ||
      withinStreetsRange(
        apartment,
        PARALELL_STREETS_PELLEGRINI,
        MIN_STREET_PELLEGRINI,
        MAX_STREET_PELLEGRINI
      )
  );
  return apartments;
};

const processPage = async (pageNumber) => {
  const { page, browser } = await initBrowser();
  try {
    const url = getUrl(pageNumber);
    await page.goto(url);
    const apartmentsContainer = await page
      .getByTestId("posting PROPERTY")
      .all();
    const apartmentsCards = await Promise.all(
      apartmentsContainer.map(async (apartment) => {
        const price = (
          await apartment.getByTestId("POSTING_CARD_PRICE").textContent()
        ).replace("$ ", "");
        const address = await apartment
          .getByTestId("POSTING_CARD_LOCATION")
          .locator("..")
          .locator("div")
          .first()
          .textContent();
        const apartmentLink = await apartment.getAttribute("data-to-posting");
        const link = `${BASE_URL}${apartmentLink}`;
        return {
          price,
          address,
          link,
        };
      })
    );
    apartmentsList.push(...apartmentsCards);
  } catch (e) {
    logger.error(e.message);
  } finally {
    await browser.close();
  }
};

const writeApartmentsInGoogleSheet = async () => {
  try {
    const apartments = await searchApartments();
    await doc.loadInfo();
   
    const sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
    let newApartmentsCount = 0;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}`
    for (const apartment of apartments) {
      const row = rows.find((row) => row.get("URL") === apartment.link);
      if (!row) {
        newApartmentsCount++;
        await sheet.addRow({
          Fecha: new Date().toLocaleString(),
          Precio: apartment.price.replace(".", ""),
          Direccion: apartment.address,
          URL: apartment.link,
        });
      }
    }
    console.log("\x1b[32m%s\x1b[0m",`${newApartmentsCount} New apartment/s found. Google Sheet URL: ${sheetUrl}`);
  } catch (e) {
    logger.error(e.message);
  }
};

const withinParalellStreetsRange = (apartment, paralell_streets) =>
  paralell_streets.some((paralell) =>
    apartment.address.toLowerCase().includes(paralell)
  );

const withinStreetsRange = (apartment, streets, min_street, max_street) =>
  streets.some((street) => apartment.address.toLowerCase().includes(street)) &&
  apartment.address
    .split(" ")
    .some((word) => word > min_street && word < max_street);

const getUrl = (page) => {
  return `${BASE_URL}/${CITY}-${MIN_PRICE}-${MAX_PRICE}-${FILTERS}-${page}.html`;
};

writeApartmentsInGoogleSheet();
// cron.schedule("*/60 * * * *", () => {
// });
