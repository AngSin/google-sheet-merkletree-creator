import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { isAddress } from 'ethers';
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import fs from 'fs';
const googleKey = require('./google-key.json'); // replace with your file name
import 'dotenv/config';

const serviceAccountAuth = new JWT({
	email: process.env.SERVICE_ACCOUNT_EMAIL,
	key: googleKey.private_key,
	scopes: [
		'https://www.googleapis.com/auth/spreadsheets',
	],
});

const spreadsheetId = process.env.SPREADSHEET_ID!!;

async function fetchEthereumWallets(spreadsheetId: string) {
	console.log("loading key");
	// Load your Google Sheets using the spreadsheet ID and credentials
	const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
	// Load the sheets in the spreadsheet
	await doc.loadInfo();
	console.log(`Doc found: ${doc.title}`);

	// Load the sheets in the spreadsheet
	await doc.loadInfo();

	const wallets = new Set<string>();

	// Function to process a single sheet
	async function processSheet(sheet: GoogleSpreadsheetWorksheet) {
		await sheet.loadHeaderRow();
		const rows = await sheet.getRows();

		// Loop through the rows and check for Ethereum wallet addresses
		for (const row of rows) {
			const columns = sheet.headerValues;
			for (const column of columns) {
				const cellValue = row.get(column);
				if (isAddress(cellValue)) {
					wallets.add(cellValue.toLowerCase()); // Store unique valid addresses in lowercase
				}
			}
		}
	}

	// Process linked spreadsheets using cell hyperlinks
	for (const sheet of doc.sheetsByIndex) {
		await sheet.loadCells();
		const rows = await sheet.getRows();

		for (const row of rows) {
			const columns = sheet.headerValues;
			for (const column of columns) {
				const cellValue = row.get(column);
				if (typeof cellValue === 'string' && cellValue.includes("docs.google.com")) {
					const linkedSpreadsheetId = cellValue.split('/')[5]; // Extract spreadsheet ID from the URL
					try {
						const linkedDoc = new GoogleSpreadsheet(linkedSpreadsheetId, serviceAccountAuth);
						await linkedDoc.loadInfo();

						for (const linkedSheet of linkedDoc.sheetsByIndex) {
							await processSheet(linkedSheet);
						}
					} catch (e) {
						console.log(`Failed to fetch wallets from sheet: ${cellValue}`);
						console.log(e);
					}
				}
			}
		}
	}

	const uniqueWallets = Array.from(wallets).map(wallet => [wallet]);
	const outputFilePath = 'wallets.json'
	fs.writeFileSync(outputFilePath, JSON.stringify(uniqueWallets, null, 2));
	console.log(`Found and saved ${uniqueWallets.length} unique Ethereum wallet addresses to ${outputFilePath}.`);
	const tree = StandardMerkleTree.of(uniqueWallets, [
		"address",
	]);
	console.log("\x1b[32m Successfully created a MerkleTree of these wallets. Root: \x1b[0m");
	console.log(tree.root);
}

fetchEthereumWallets(spreadsheetId)
	.catch((error) => console.error('Error:', error));
