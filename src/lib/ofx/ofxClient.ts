import { decryptToken } from "lib/encryption/tokenEncryption";
import parseOfx from "lib/import/parseOfx";

import type { ParsedTransaction } from "lib/import/importTransactions";

type OfxConnectionConfig = {
	/** Bank's OFX server URL */
	ofxUrl: string;
	/** OFX organization ID (from FI directory) */
	org: string;
	/** OFX FI ID */
	fid: string;
	/** User's online banking username */
	username: string;
	/** User's online banking password (encrypted) */
	encryptedPassword: string;
	/** Bank account number */
	accountNumber: string;
	/** Bank routing number */
	routingNumber: string;
	/** Account type: CHECKING, SAVINGS, CREDITCARD */
	accountType: string;
};

/**
 * Build an OFX request for statement download (SGML v1 format).
 * Most US banks still use OFX v1 (SGML)
 */
const buildOfxRequest = (
	config: OfxConnectionConfig,
	startDate: string,
): string => {
	const password = decryptToken(config.encryptedPassword);
	const now = new Date();
	const dtClient = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
	// Format: YYYYMMDD
	const dtStart = startDate.replace(/-/g, "");

	const isCreditCard = config.accountType === "CREDITCARD";

	const accountBlock = isCreditCard
		? `<CCACCTFROM><ACCTID>${config.accountNumber}</CCACCTFROM>`
		: `<BANKACCTFROM><BANKID>${config.routingNumber}<ACCTID>${config.accountNumber}<ACCTTYPE>${config.accountType}</BANKACCTFROM>`;

	const msgSet = isCreditCard ? "CREDITCARDMSGSRQV1" : "BANKMSGSRQV1";
	const trnRq = isCreditCard ? "CCSTMTTRNRQ" : "STMTTRNRQ";
	const stmtRq = isCreditCard ? "CCSTMTRQ" : "STMTRQ";

	return [
		"OFXHEADER:100",
		"DATA:OFXSGML",
		"VERSION:102",
		"SECURITY:NONE",
		"ENCODING:USASCII",
		"CHARSET:1252",
		"COMPRESSION:NONE",
		"OLDFILEUID:NONE",
		"NEWFILEUID:NONE",
		"",
		"<OFX>",
		"<SIGNONMSGSRQV1><SONRQ>",
		`<DTCLIENT>${dtClient}`,
		`<USERID>${config.username}`,
		`<USERPASS>${password}`,
		"<LANGUAGE>ENG",
		`<FI><ORG>${config.org}<FID>${config.fid}</FI>`,
		"<APPID>QWIN<APPVER>2700",
		"</SONRQ></SIGNONMSGSRQV1>",
		`<${msgSet}><${trnRq}><TRNUID>${crypto.randomUUID()}`,
		`<${stmtRq}>`,
		accountBlock,
		`<INCTRAN><DTSTART>${dtStart}<INCLUDE>Y</INCTRAN>`,
		`</${stmtRq}>`,
		`</${trnRq}></${msgSet}>`,
		"</OFX>",
	].join("\n");
};

/**
 * Fetch transactions from a bank via OFX Direct Connect.
 * @param config - OFX connection configuration
 * @param startDate - Fetch transactions from this date (YYYY-MM-DD)
 * @returns Parsed transactions
 */
const fetchOfxTransactions = async (
	config: OfxConnectionConfig,
	startDate: string,
): Promise<ParsedTransaction[]> => {
	const requestBody = buildOfxRequest(config, startDate);

	const response = await fetch(config.ofxUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-ofx",
			Accept: "application/ofx",
		},
		body: requestBody,
	});

	if (!response.ok) {
		throw new Error(
			`OFX request failed: ${response.status} ${response.statusText}`,
		);
	}

	const responseText = await response.text();

	// Check for OFX error in signon response
	const statusMatch = responseText.match(/<CODE>(\d+)/);
	if (statusMatch && statusMatch[1] !== "0") {
		throw new Error(`OFX server returned error code: ${statusMatch[1]}`);
	}

	return parseOfx(responseText);
};

export { buildOfxRequest, fetchOfxTransactions };

export type { OfxConnectionConfig };
