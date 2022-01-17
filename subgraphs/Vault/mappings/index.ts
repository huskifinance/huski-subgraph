/* eslint-disable prefer-const */
import {Address, BigInt, ethereum} from "@graphprotocol/graph-ts";
import {
    KillData,
    LendData,
    PositionData,
    PriceUpdateData, TotalPositionValue,
    VaultData,
    VaultDayData
} from "../generated/schema";
import {Work, Transfer, Kill, Vault} from "../generated/Vault-ibBNB/Vault";
import {PancakeswapV2Worker} from "../generated/Vault-ibBNB/PancakeswapV2Worker";

import { ERC20 } from "../generated/Vault-ibBNB/ERC20";
import { IVaultConfig } from "../generated/Vault-ibBNB/IVaultConfig";

export function handleWork(event: Work): void{
    let WorkID = event.transaction.hash.toHex()
    let vaultData = new VaultData(WorkID)
    vaultData.address = event.address.toHex()
    vaultData.time = event.block.timestamp
    vaultData.loan = event.params.loan
    vaultData.block = event.block.number
    vaultData.transactionHash = event.transaction.hash.toHex()

    let vault = Vault.bind(event.address)
    let positionId = event.address.toHex().concat("-").concat(event.params.id.toString())
    //
    handlePositionInfo(event.address,positionId,event.params.id,vault)

    vaultData.lpToken = fetchTotalBaseToken(vault,event.params.id)

    vaultData.ratePerSec = fetchRatePerSec(vault,event.address)

    let baseTokeAddress = vault.try_token().value

    vaultData.baseTokenAddress = baseTokeAddress.toHex()

    //day
    let vaultDayData = updateWorkDayData(event);
    vaultDayData.baseTokenAddress=baseTokeAddress.toHex()
    let dailyLoan = vaultDayData.dailyLoan
    if (dailyLoan !== null) {
        vaultDayData.dailyLoan = dailyLoan.plus(event.params.loan)
    }else {
        vaultDayData.dailyLoan = event.params.loan
    }
    //
    let dailyLpAmount = vaultDayData.dailyLpToken
    if (dailyLpAmount!==null){
        vaultDayData.dailyLpToken = dailyLpAmount.plus(vaultData.lpToken)
    }else {
        vaultDayData.dailyLpToken = vaultData.lpToken
    }

    //24hTVL
    let dailyBaseTokenTVL = vaultDayData.dailyBaseTokenTVL
    if (dailyBaseTokenTVL !== null){
        vaultDayData.dailyBaseTokenTVL = dailyBaseTokenTVL.plus(vaultData.lpToken)
    }else {
        vaultDayData.dailyBaseTokenTVL = vaultData.lpToken
    }
    //Daily borrowing interest mean
    let dailyBorrowingInterestMean = vaultDayData.dailyRatePerSec
    if (dailyBorrowingInterestMean !== null){
        vaultDayData.dailyRatePerSec = dailyBorrowingInterestMean.plus(vaultData.ratePerSec).div(BigInt.fromI32(2))
    } else {
        vaultDayData.dailyRatePerSec = vaultData.ratePerSec
    }

    vaultData.save()
    vaultDayData.save()
}

export function updateWorkDayData(event:ethereum.Event): VaultDayData{
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    let dayStartTimestamp = dayID * 86400;
    let dayWorkID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString());

    let vaultDayData = VaultDayData.load(dayWorkID)
    if (vaultDayData === null) {
        vaultDayData = new VaultDayData(dayWorkID)
        vaultDayData.date= BigInt.fromI32(dayStartTimestamp);
    }
    // vaultDayData.save();
    return vaultDayData as VaultDayData
}

export function handleTransfer(event: Transfer):void{
    let a = "0x0000000000000000000000000000000000000000"
    if (event.params.from.toHex() == a){
        let lend = new LendData(event.transaction.hash.toHex())
        lend.address = event.address.toHex()
        lend.transactionHash = event.transaction.hash
        lend.block = event.block.number
        lend.from = event.params.from
        lend.to = event.params.to
        lend.value = event.params.value
        lend.baseAmount = fetchShareToBalance(event.address,event.params.value)
        lend.save()
    }
}

export function fetchShareToBalance(vaultAddress:Address,debt:BigInt):BigInt {
    let vault = Vault.bind(vaultAddress)
    let totalToken = vault.try_totalToken()
    let totalSupply = vault.try_totalSupply()
    return debt.times(totalToken.value).div(totalSupply.value)
}

export function handleKill(event:Kill): void{
    let killData = new KillData(event.transaction.hash.toHex())

    let vault = Vault.bind(event.address)
    let positionId = event.address.toHex().concat("-").concat(event.params.id.toString())
    handlePositionInfo(event.address,positionId,event.params.id,vault)


    killData.Killer = event.params.killer
    killData.owner = event.params.owner
    killData.posVal = event.params.posVal
    killData.debt = event.params.debt
    killData.prize = event.params.prize
    killData.left = event.params.left
    killData.block = event.block.number
    killData.transactionHash = event.transaction.hash
    killData.save()
}

export function fetchTotalBaseToken(vault:Vault,wokerID:BigInt): BigInt{
    let positions = vault.try_positions(wokerID)
    let workContract = PancakeswapV2Worker.bind(positions.value.value0)
    let health = workContract.try_health(wokerID)
    return health.value;
}

//
export function fetchRatePerSec(vault:Vault,vaultAddress:Address):BigInt{
    //
    let baseTokeAddress = vault.try_token().value
    //
    let baseToke = ERC20.bind(baseTokeAddress)
    let balance = baseToke.try_balanceOf(vaultAddress).value
    let vaultDebtVal =vault.try_vaultDebtVal().value
    let configAddress= vault.try_config().value
    let config = IVaultConfig.bind(configAddress)
    return config.try_getInterestRate(vaultDebtVal,balance).value
}

export function handlePositionInfo(address:Address,positionId:string,id:BigInt,vault:Vault):void {
    let totalPositionValue = TotalPositionValue.load(address.toHex())
    if (totalPositionValue === null){
        totalPositionValue = new TotalPositionValue(address.toHex())
        totalPositionValue.totalPositionValue=BigInt.zero()
        totalPositionValue.save()
    }
    let positionData = PositionData.load(positionId)
    if (positionData === null){
        positionData = new PositionData(positionId)
        let position = vault.try_positions(id).value
        positionData.worker = position.value0.toHex()
        positionData.owner = position.value1.toHex()
        let positionInfo = vault.try_positionInfo(id)
        positionData.lpToken = positionInfo.value.value0
        positionData.debtVal = positionInfo.value.value1
        totalPositionValue.totalPositionValue=totalPositionValue.totalPositionValue.plus(positionInfo.value.value0)
        totalPositionValue.save()
        positionData.save()
    }else {
        let position = vault.try_positions(id).value
        positionData.worker = position.value0.toHex()
        positionData.owner = position.value1.toHex()
        let positionInfo = vault.try_positionInfo(id)
        let destChange = positionInfo.value.value1.minus(positionData.lpToken)
        totalPositionValue.totalPositionValue=totalPositionValue.totalPositionValue.plus(destChange)
        positionData.lpToken = positionInfo.value.value0
        positionData.debtVal = positionInfo.value.value1

        positionData.save()
        totalPositionValue.save()
    }


}

