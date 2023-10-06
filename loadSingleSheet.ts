import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { isAddress } from 'ethers';
import fs from 'fs';
const googleKey = require('./google-key.json'); // replace with your file name
import 'dotenv/config';
import {StandardMerkleTree} from "@openzeppelin/merkle-tree";

const serviceAccountAuth = new JWT({
	email: process.env.SERVICE_ACCOUNT_EMAIL,
	key: googleKey.private_key,
	scopes: [
		'https://www.googleapis.com/auth/spreadsheets',
	],
});

const spreadsheetId = process.env.SPREADSHEET_ID!!;

async function fetchEthereumWalletsFromSheet(spreadsheetId: string) {
	console.log("loading key");
	// Load your Google Sheets using the spreadsheet ID and credentials
	const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
	await doc.loadInfo();
	console.log(`Doc found: ${doc.title}`);

	const wallets = new Set<string>();

	for (const sheet of doc.sheetsByIndex) {

		await sheet.loadHeaderRow();
		const rows = await sheet.getRows();

		for (const row of rows) {
			const columns = sheet.headerValues;
			for (const column of columns) {
				const cellValue = row.get(column);
				if (isAddress(cellValue)) {
					wallets.add(cellValue.toLowerCase());
				}
			}
		}
	}

	const uniqueWallets = Array.from(wallets).map(wallet => [wallet]);
	const outputFilePath = doc.title.toLowerCase().split(' ').join('-').concat('.json');
	console.log(`Found ${uniqueWallets.length} wallets, writing them to ${outputFilePath}`)
	fs.writeFileSync(outputFilePath, JSON.stringify(uniqueWallets, null, 2));

	const tree = StandardMerkleTree.of(uniqueWallets, [
		"address",
	]);
	console.log("\x1b[32mSuccessfully created a MerkleTree of these wallets. Root:\x1b[0m");
	console.log(tree.root);
}

fetchEthereumWalletsFromSheet(spreadsheetId)
	.catch((error) => console.error('Error:', error));