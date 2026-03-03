/**
 * ATLAS REST API Connector (stub)
 * Connects to external TMS / carrier APIs
 *
 * NOTE: This is a stub connector for v0.1.
 * Full REST/OAuth implementation will be added in v0.2.
 */

export class ApiConnector {
  constructor(config = {}) {
    this.config = config;
    this.baseUrl = config.base_url ?? null;
    this.apiKey = config.api_key ?? null;
  }

  /**
   * Fetch shipment data from external API
   * @param {string} shipmentId
   * @returns {Promise<object|null>}
   */
  async getShipment(shipmentId) {
    if (!this.baseUrl) {
      console.log("[ATLAS] API connector: base_url not configured");
      return null;
    }
    console.log(
      `[ATLAS] API connector: stub — would GET ${this.baseUrl}/shipments/${shipmentId}`
    );
    // Stub: would call fetch()/axios with auth headers and return normalized data
    return null;
  }

  /**
   * Fetch rate quotes from carrier API
   * @param {object} params - Lane, mode, weight, dates
   * @returns {Promise<Array>}
   */
  async getRates(params) {
    if (!this.baseUrl) return [];
    console.log(
      `[ATLAS] API connector: stub — would POST ${this.baseUrl}/rates with`,
      params
    );
    return [];
  }

  /**
   * Push a tracking event to an external system
   * @param {object} event - ATLAS event object
   * @returns {Promise<boolean>}
   */
  async pushEvent(event) {
    if (!this.baseUrl) return false;
    console.log(
      `[ATLAS] API connector: stub — would POST ${this.baseUrl}/events`
    );
    return false;
  }

  /**
   * Test connection to the external API
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    if (!this.baseUrl) return false;
    console.log(
      `[ATLAS] API connector: stub — would GET ${this.baseUrl}/health`
    );
    return false;
  }
}

export default ApiConnector;
