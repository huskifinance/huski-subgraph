/* eslint-disable prefer-const */
import {Address, BigInt, ethereum} from "@graphprotocol/graph-ts";
import {
    KillData,
    DepositData,
    PositionData,
    PositionDayData,
    VaultDayData,
    WithdrawData
} from "../generated/schema";
import {Work, Transfer, Kill, Vault, AddDebt} from "../generated/Vault-ibBNB/Vault";
import {PancakeswapV2Worker} from "../generated/Vault-ibBNB/PancakeswapV2Worker";

import { ERC20 } from "../generated/Vault-ibBNB/ERC20";
import { IVaultConfig } from "../generated/Vault-ibBNB/IVaultConfig";

export function handleWork(event: Work): void{
    let WorkID = event.address.toHex().concat("-").concat(event.params.id.toString())
    let positionData = PositionData.load(WorkID)
    let vault = Vault.bind(event.address)

    if (positionData == null){
        positionData = new PositionData(WorkID)
        positionData.positionId = event.params.id
    }

    // When lpToken==0, the position has been closed, record the time
    if (fetchTotalBaseToken(vault,event.params.id) == BigInt.zero()){
        return
    }

    positionData.vaultAddress = event.address.toHex()
    positionData.time = event.block.timestamp
    positionData.loan = event.params.loan
    positionData.block = event.block.number
    positionData.transactionHash = event.transaction.hash.toHex()
    positionData.baseTokenAmount = fetchTotalBaseToken(vault,event.params.id)

    positionData.ratePerSec = fetchRatePerSec(vault,event.address)

    let baseTokeAddress = vault.try_token().value

    positionData.baseTokenAddress = baseTokeAddress.toHex()

    //day
    let vaultDayData = updateWorkDayData(event);
    vaultDayData.baseTokenAddress=baseTokeAddress.toHex()
    //dailyLoan
    let loan = vaultDayData.loan
    if (loan !== null) {
        vaultDayData.loan = loan.plus(event.params.loan)
    }else {
        vaultDayData.loan = event.params.loan
    }
    //
    let dailyLpAmount = vaultDayData.baseTokenAmount
    if (dailyLpAmount!==null){
        vaultDayData.baseTokenAmount = dailyLpAmount.plus(positionData.baseTokenAmount)
    }else {
        vaultDayData.baseTokenAmount = positionData.baseTokenAmount
    }

    //Daily borrowing interest mean
    let dailyBorrowingInterestMean = vaultDayData.ratePerSec
    if (dailyBorrowingInterestMean !== null){
        vaultDayData.ratePerSec = dailyBorrowingInterestMean.plus(positionData.ratePerSec).div(BigInt.fromI32(2))
    } else {
        vaultDayData.ratePerSec = positionData.ratePerSec
    }

    positionData.save()
    vaultDayData.save()
}

export function handleAddDebt(event: AddDebt):void {
    let WorkID = event.address.toHex().concat("-").concat(event.params.id.toString())

    let positionData = PositionData.load(WorkID)
    if (positionData === null){
        positionData = new PositionData(WorkID)
    }

    let addDebt:BigInt,oldDebt:BigInt | null
    let vault = Vault.bind(event.address)
    let oldTime:number

    let timestamp = positionData.time.toI32()
    let dayID = timestamp / 86400;
    oldTime = dayID * 86400

    let vaultDayData = updateWorkDayData(event);
    // positionData.debtShare = event.params.debtShare
    oldDebt = positionData.debt

    addDebt = debtShareToVal(vault,event.params.debtShare)
    positionData.debt = addDebt

    let baseTokenTVL = vaultDayData.baseTokenTVL
    if (oldDebt === null){
        if (baseTokenTVL !== null){
            updatePositionDayData(event,positionData.baseTokenAmount)
            vaultDayData.baseTokenTVL = baseTokenTVL.plus(positionData.baseTokenAmount).minus(addDebt)
        }else {
            vaultDayData.baseTokenTVL = positionData.baseTokenAmount.minus(addDebt)
        }
    }else if (addDebt>oldDebt){
        if (vaultDayData.date.toI32()===oldTime){
            vaultDayData.baseTokenTVL = baseTokenTVL.plus(addDebt.minus(oldDebt))
        }else {
            updatePositionDayData(event,positionData.baseTokenAmount)
            vaultDayData.baseTokenTVL = baseTokenTVL.plus(positionData.baseTokenAmount).minus(addDebt)
        }
    }

    //dailyAddDebt
    let debt = vaultDayData.debt
    if (debt!==null){
        vaultDayData.debt = debt.plus(addDebt)
    }else {
        vaultDayData.debt = addDebt
    }

    positionData.save()
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
        vaultDayData.baseTokenTVL = BigInt.zero()
    }
    // vaultDayData.save();
    return vaultDayData as VaultDayData
}

export function updatePositionDayData(event:ethereum.Event,baseTokenAmount:BigInt):void {
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    let dayStartTimestamp = dayID * 86400;
    let dayWorkID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString());

    let positionDayDate = PositionDayData.load(dayWorkID)
    if (positionDayDate === null){
        positionDayDate = new PositionDayData(dayWorkID)
        positionDayDate.date= BigInt.fromI32(dayStartTimestamp);
        positionDayDate.positionTotalAmount = BigInt.zero()
    }
    positionDayDate.positionTotalAmount=positionDayDate.positionTotalAmount.plus(baseTokenAmount)

    positionDayDate.save()
}

export function handleTransfer(event: Transfer):void{
    let a = "0x0000000000000000000000000000000000000000"

    if (event.params.from.toHex() == a){
        updateLendData(event)
        return
    }else if (event.params.to.toHex() ==a){
        updateWithdrawData(event)
        return;
    }

}

export function updateWithdrawData(event:Transfer):void {
    let withdrawData = new WithdrawData(event.transaction.hash.toHex())
    withdrawData.vaultAddress = event.address.toHex()
    withdrawData.time = event.block.timestamp
    withdrawData.transactionHash = event.transaction.hash
    withdrawData.block = event.block.number
    withdrawData.withdrawAccount = event.params.from
    // withdrawData.withdrawShare = event.params.value
    withdrawData.withdrawAmount = fetchShareToBalance(event.address,event.params.value)
    withdrawData.save()
}

export function updateLendData(event:Transfer):void {
    let vaultDayData = updateWorkDayData(event);
    vaultDayData.baseTokenTVL=vaultDayData.baseTokenTVL.plus(event.params.value)
    vaultDayData.save()
    
    let deposit = new DepositData(event.transaction.hash.toHex())
    deposit.vaultAddress = event.address.toHex()
    deposit.time = event.block.timestamp
    deposit.transactionHash = event.transaction.hash
    deposit.block = event.block.number
    deposit.depositAccount = event.params.to
    // deposit.depositShare = event.params.value
    deposit.depositAmount = fetchShareToBalance(event.address,event.params.value)
    deposit.save()
}

export function fetchShareToBalance(vaultAddress:Address,debt:BigInt):BigInt {
    let vault = Vault.bind(vaultAddress)
    let totalToken = vault.try_totalToken()
    let totalSupply = vault.try_totalSupply()
    return debt.times(totalToken.value).div(totalSupply.value)
}

export function handleKill(event:Kill): void{
    let killID = event.address.toHex().concat("-").concat(event.params.id.toString())
    let killData = new KillData(killID)

    let positionData = PositionData.load(killID)
    if (positionData!==null){
        positionData.killTime=event.block.timestamp
    }


    killData.killer = event.params.killer
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


export function fetchRatePerSec(vault:Vault,vaultAddress:Address):BigInt{
    let baseTokeAddress = vault.try_token().value
    let baseToke = ERC20.bind(baseTokeAddress)
    let balance = baseToke.try_balanceOf(vaultAddress).value
    let vaultDebtVal =vault.try_vaultDebtVal().value
    let configAddress= vault.try_config().value
    let config = IVaultConfig.bind(configAddress)
    return config.try_getInterestRate(vaultDebtVal,balance).value
}

export function debtShareToVal(vault:Vault,debtShare:BigInt):BigInt{
    let val = vault.try_debtShareToVal(debtShare)
    return val.value

}

