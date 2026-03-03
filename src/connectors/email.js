/**
 * ATLAS Email Connector (IMAP stub)
 * Reads shipment-related emails from configured inbox
 *
 * NOTE: This is a stub connector for v0.1.
 * Full IMAP/MIME parsing will be implemented in v0.2.
 * Requires live IMAP credentials in config.yml.
 */

export class EmailConnector {
  constructor(config = {}) {
    this.config = config;
    this.connected = false;
  }

  /**
   * Connect to IMAP server
   * @returns {Promise<void>}
   */
  async connect() {
    console.log(
      "[ATLAS] Email connector: configured but requires live IMAP connection"
    );
    console.log(
      `[ATLAS] Email config: host=${this.config.host ?? "(not set)"}, user=${this.config.username ?? "(not set)"}`
    );

    // Stub: in a real implementation this would:
    // 1. Connect via node-imap or imapflow
    // 2. Authenticate with credentials from config
    // 3. Open the configured mailbox folder
    this.connected = false;
    return false;
  }

  /**
   * Fetch unread emails from inbox
   * @param {object} opts
   * @param {number} opts.limit - Max emails to fetch
   * @returns {Promise<Array>}
   */
  async fetchUnread({ limit = 20 } = {}) {
    if (!this.connected) {
      console.log("[ATLAS] Email connector: not connected — returning empty results");
      return [];
    }

    // Stub: would parse emails and extract:
    // - Shipment references from subject lines
    // - Rate quotes from email bodies
    // - Document attachments (BOL, invoices)
    return [];
  }

  /**
   * Extract logistics entities from an email
   * @param {object} email - Raw email object
   * @returns {object} Extracted entities
   */
  async parseEmail(email) {
    // Stub: would use regex + NLP to extract:
    // - Shipment IDs, references
    // - Origin/destination locations
    // - Rates, weights, dimensions
    // - Dates
    return {
      shipment_references: [],
      rates: [],
      locations: [],
      dates: [],
    };
  }

  async disconnect() {
    this.connected = false;
  }
}

export default EmailConnector;
