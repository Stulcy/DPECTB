async function extendedFundingTest() {
  const symbols = ["BTC-USD", "ETH-USD", "BNB-USD", "SUI-USD"];
  const apiUrl = "https://api.starknet.extended.exchange";

  try {
    // Build query string for multiple markets
    const queryString = symbols.map((symbol) => `market=${symbol}`).join("&");

    // Get current funding rate from markets endpoint
    const response = await fetch(
      `${apiUrl}/api/v1/info/markets?${queryString}`,
      {
        headers: {
          "User-Agent": "DPECTB-Bot/1.0",
        },
      }
    );

    if (!response.ok) {
      console.error(
        `Extended API error: ${response.status} ${response.statusText}`
      );
      return;
    }

    const responseText = await response.text();
    const responseData = JSON.parse(responseText);

    console.log("Extended Funding Rates:");
    console.log("======================");

    if (responseData.data && Array.isArray(responseData.data)) {
      for (const market of responseData.data) {
        const symbol = market.name;
        const fundingRate = market.marketStats?.fundingRate;
        
        if (fundingRate !== undefined) {
          console.log(`${symbol}: ${fundingRate}`);
        } else {
          console.log(`${symbol}: No funding rate available`);
        }
      }
    } else {
      console.log("No market data found in response");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

extendedFundingTest();

async function hyperliquidFundingTest() {
  const symbols = ["BTC", "ETH", "BNB", "SUI"];

  try {
    // Get current funding rate from markets endpoint
    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "metaAndAssetCtxs",
      }),
    });

    if (!response.ok) {
      console.error(
        `Hyperliquid API error: ${response.status} ${response.statusText}`
      );
      return;
    }

    const responseText = await response.text();
    const responseData = JSON.parse(responseText);

    console.log("Hyperliquid Funding Rates:");
    console.log("=========================");

    for (const symbol of symbols) {
      const symbolIndex = responseData[0]?.universe?.findIndex(
        (asset: any) => asset.name === symbol
      );

      if (
        symbolIndex !== -1 &&
        responseData[1] &&
        responseData[1][symbolIndex]
      ) {
        const ctx = responseData[1][symbolIndex];
        console.log(`${symbol}: ${ctx.funding}`);
      } else {
        console.log(`${symbol}: Not found`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

hyperliquidFundingTest();
