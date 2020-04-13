import axios, { AxiosRequestConfig, Method } from "axios";
import { toBitcoin } from "satoshi-bitcoin";

/**
 * Interface defining the Bitcoin wallet functionalities needed by the SDK to execute a swap involving Bitcoin.
 * It is expected from a COMIT App developer to write their own class that would implement this interface.
 * Depending on the use case and platform, such class could interact with a hardware wallet API, display QR codes,
 * take input via text fields, etc.
 */
export interface BitcoinWallet {
  getAddress(): Promise<string>;

  getBalance(): Promise<number>;

  sendToAddress(
    address: string,
    satoshis: number,
    network: Network
  ): Promise<string>;

  broadcastTransaction(
    transactionHex: string,
    network: Network
  ): Promise<string>;

  getFee(): string;
}

/**
 * Instance of a bitcoind wallet.
 *
 * This is to be used for demos, examples and dev environment only. No safeguards are applied, no data is written on
 * the disk.
 * This is not to be used for mainnet, instead, implement your own {@link BitcoinWallet}
 */
export class BitcoindWallet implements BitcoinWallet {
  public static async newInstance(
    httpUrl: string,
    username: string,
    password: string,
    walletName: string,
    privkey?: string
  ): Promise<BitcoindWallet> {
    const auth = { username, password };

    const walletExists = await axios
      .post(
        httpUrl,
        {
          jsonrpc: "1.0",
          method: "listwallets"
        },
        { auth }
      )
      .then(res => res.data.result.includes(walletName));

    if (!walletExists) {
      await axios.post(
        httpUrl,
        {
          jsonrpc: "1.0",
          method: "createwallet",
          params: [walletName]
        },
        { auth }
      );
    }

    const rpcRequestConfig = {
      url: `${httpUrl}/wallet/${walletName}`,
      method: "post" as Method,
      auth
    };

    if (!!privkey) {
      await axios.request({
        ...rpcRequestConfig,
        data: { jsonrpc: "1.0", method: "importprivkey", params: [privkey] }
      });
    }

    return new BitcoindWallet(rpcRequestConfig);
  }

  private constructor(private rpcRequestConfig: AxiosRequestConfig) {}

  public async getBalance(): Promise<number> {
    const res = await axios.request({
      ...this.rpcRequestConfig,
      data: { jsonrpc: "1.0", method: "getbalance", params: [] }
    });
    return res.data.result;
  }

  public async getAddress(): Promise<string> {
    const res = await axios.request({
      ...this.rpcRequestConfig,
      data: { jsonrpc: "1.0", method: "getnewaddress", params: [] }
    });

    return res.data.result;
  }

  public async sendToAddress(
    address: string,
    satoshis: number,
    network: Network
  ): Promise<string> {
    await this.assertNetwork(network);

    const res = await axios.request({
      ...this.rpcRequestConfig,
      data: {
        jsonrpc: "1.0",
        method: "sendtoaddress",
        params: [address, toBitcoin(satoshis)]
      }
    });

    return res.data.result;
  }

  public async broadcastTransaction(
    transactionHex: string,
    network: Network
  ): Promise<string> {
    await this.assertNetwork(network);

    const res = await axios.request({
      ...this.rpcRequestConfig,
      data: {
        jsonrpc: "1.0",
        method: "sendrawtransaction",
        params: [transactionHex]
      }
    });

    return res.data.result;
  }

  public getFee(): string {
    // should be dynamic in a real application
    return "150";
  }

  public async close(): Promise<void> {
    await axios.request({
      ...this.rpcRequestConfig,
      data: {
        jsonrpc: "1.0",
        method: "unloadwallet",
        params: []
      }
    });
  }

  private async assertNetwork(network: Network): Promise<void> {
    const res = await axios.request({
      ...this.rpcRequestConfig,
      data: { jsonrpc: "1.0", method: "getblockchaininfo", params: [] }
    });

    if (res.data.result.chain !== network) {
      return Promise.reject(
        `This wallet is only connected to the ${network} network and cannot perform actions on the ${network} network`
      );
    }
  }
}

export type Network = "bitcoin" | "testnet" | "regtest";
