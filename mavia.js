const { providers, Wallet, utils, BigNumber, ethers } = require("ethers")
const {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} = require("@flashbots/ethers-provider-bundle")
const { exit } = require("process")


/*

  yang perlu diubah / di isi: 

  KEY_OWNER
  KEY_KORBAN
  data
  ==>>  contract: "0x7ad4C1647aA947D1c05425a8d4d155eF811a5f9E",
        data: "0x4blabla"
  ==>> value: utils.parseEther("0.008"),
*/

const provider = new providers.JsonRpcProvider('https://rpc.ankr.com/eth')
const RELAY = "https://relay.flashbots.net"
const KEY_OWNER = "0xPrivateKey"
const KEY_KORBAN = "0xPrivateKey"


const TOKEN_TRANSFER = {
  contract: "0x24fcfc492c1393274b6bcd568ac9e225bec93584",
  data: "0xa9059cbb00000000000000000000000047fccb25540da9a3f096bded84c949804ad25c4b000000000000000000000000000000000000000000000000ad78ebc5ac620000"
}
const DISTRIBUTOR = {
  contract: "0x7ad4C1647aA947D1c05425a8d4d155eF811a5f9E",
  data: "0x497de662000000000000000000000000000000000000000000000000ad78ebc5ac62000000000000000000000000000000000000c361a2908e34433b8bf8d0f7a217e7c10000000000000000000000000000000000000000000000000000000065c83a5b00000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000041cb1b0ee4d2daf4383cc893853b792b4fddb95228545f0214cfb666cb2cb1b48a376e401dd08a218dae88de5fec55b02669011b318d68b36d9ee19f42faa7b11c1c00000000000000000000000000000000000000000000000000000000000000"
}

const owner = new Wallet(KEY_OWNER).connect(provider)
const korban = new Wallet(KEY_KORBAN).connect(provider)
let maxFeePerGas
let maxPriorityFeePerGas


const main = async () => {


  const authSigner = Wallet.createRandom()

  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    RELAY
  )



  provider.on("block", async (blockNumber) => {
    console.log(`Sedang Mencari Block... \nBlock saat ini: ${blockNumber}`)
    const targetBlockNumber = blockNumber + 1


    const fee = await owner.populateTransaction({
      to: korban.address,
      value: utils.parseEther("0")
    })

    maxFeePerGas = fee.maxFeePerGas
    maxPriorityFeePerGas = fee.maxPriorityFeePerGas
    const nonce_korban = await korban.getTransactionCount()
    const signedTransactions = await flashbotsProvider.signBundle([
      {
        signer: owner,
        transaction: {
          chainId: 1,
          type: 2,
          to: korban.address,
          gasLimit: 21000,
          maxFeePerGas,
          maxPriorityFeePerGas,
          value: utils.parseEther("0.008"),
        }
      },
      {
        signer: korban,
        transaction: {
          chainId: 1,
          type: 2,
          to: DISTRIBUTOR.contract,
          gasLimit: 123285,
          maxFeePerGas,
          maxPriorityFeePerGas,
          data: DISTRIBUTOR.data,
          nonce: nonce_korban
        }
      },
      {
        signer: korban,
        transaction: {
          chainId: 1,
          type: 2,
          to: TOKEN_TRANSFER.contract,
          gasLimit: 97062,
          maxFeePerGas,
          maxPriorityFeePerGas,
          data: TOKEN_TRANSFER.data,
          nonce: nonce_korban + 1
        }
      },
    ])

    const simulasions = await flashbotsProvider.simulate(signedTransactions, targetBlockNumber)
    if (simulasions.error) {
      console.log(simulasions.error.message)

    } else if (simulasions.results[1].revert) {
      console.log(simulasions.results[1])
      console.log(simulasions.results[2])
    } else {
      const bundleSubmission = await flashbotsProvider.sendRawBundle(
        signedTransactions,
        targetBlockNumber
      )


      if ("error" in bundleSubmission) {
        console.log(bundleSubmission.error.message)
        return
      }

      const resolution = await bundleSubmission.wait()
      if (resolution === FlashbotsBundleResolution.BundleIncluded) {
        console.log("######################################################")
        console.log(
          `Transaksi Sukses!!, Transaksi di eksekusi di Block: ${targetBlockNumber}`
        )
        bundleSubmission.bundleTransactions.map((asd) => {
          console.log(`Tx Hash: \nhttps://etherscan.io/tx/${asd.hash}`)
        })
        exit(0)
      } else if (
        resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
      ) {
        console.log(
          `Transaksi gk ke eksekusi di block: ${targetBlockNumber} \nMencari blok lain...\n`
        )
      } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
        console.log("Nonce Ketinggian, Hmm..")
        exit(1)
      }
    }

  })

}

main()
