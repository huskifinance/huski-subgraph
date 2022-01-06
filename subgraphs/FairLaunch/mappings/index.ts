import {Deposit, DepositCall, EmergencyWithdraw, FairLaunch, Withdraw} from "../generated/FairLaunch/FairLaunch";
import {
    // DepositCallData,
    PoolInfoDtat,
    StakeDepositData,
    StakeDepositDayData,
    StakeEmergencyWithdrawData, StakeEmergencyWithdrawDayData,
    StakeWithdrawData, StakeWithdrawDayData
} from "../generated/schema";
import {Address, BigInt, ethereum} from "@graphprotocol/graph-ts";

export function handleDeposit(event:Deposit):void{
    let stakeDepositData = new StakeDepositData(event.transaction.hash.toHex())
    stakeDepositData.block = event.block.number
    stakeDepositData.transactionHash = event.transaction.hash
    stakeDepositData.pid = event.params.pid
    stakeDepositData.user = event.params.user
    stakeDepositData.amount = event.params.amount
    let stakeDepositDayData = updateDepositDay(event)
    let amount = stakeDepositDayData.amount
    if (amount !== null){
        stakeDepositDayData.amount = amount.plus(event.params.amount)
    }else {
        stakeDepositDayData.amount = event.params.amount
    }
    stakeDepositData.save()
    stakeDepositDayData.save()
}

export function handleWithdraw(event:Withdraw):void{
    let stakeWithdrawData = new StakeWithdrawData(event.transaction.hash.toHex())
    stakeWithdrawData.block = event.block.number
    stakeWithdrawData.transactionHash = event.transaction.hash
    stakeWithdrawData.pid = event.params.pid
    stakeWithdrawData.user = event.params.user
    stakeWithdrawData.amount = event.params.amount
    let stakeWithdrawDayData = updateWithdrawDay(event)
    let amount = stakeWithdrawDayData.amount
    if (amount !== null){
        stakeWithdrawDayData.amount = amount.plus(event.params.amount)
    }else {
        stakeWithdrawDayData.amount = event.params.amount
    }
    stakeWithdrawData.save()
    stakeWithdrawDayData.save()
}

export function handleEmergencyWithdraw(event:EmergencyWithdraw):void{
    let stakeEmergencyWithdrawData = new StakeEmergencyWithdrawData(event.transaction.hash.toHex())
    stakeEmergencyWithdrawData.block = event.block.number
    stakeEmergencyWithdrawData.transactionHash = event.transaction.hash
    stakeEmergencyWithdrawData.pid = event.params.pid
    stakeEmergencyWithdrawData.user = event.params.user
    stakeEmergencyWithdrawData.amount = event.params.amount
    let stakeEmergencyWithdrawDayData = updateEmergencyWithdrawDay(event)
    let amount = stakeEmergencyWithdrawDayData.amount
    if (amount !== null){
        stakeEmergencyWithdrawDayData.amount = amount.plus(event.params.amount)
        fetchPoolInfo(event.address,event.params.pid)
    }else {
        stakeEmergencyWithdrawDayData.amount = event.params.amount
    }
    stakeEmergencyWithdrawDayData.save()
    stakeEmergencyWithdrawData.save()
}

export function updateDepositDay(event:Deposit):StakeDepositDayData{
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    // let dayStartTimestamp = dayID * 86400;
    let pid = event.params.pid
    let ID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString()).concat("-").concat(pid.toString());

    let stakeDepositDayData = StakeDepositDayData.load(ID)
    if (stakeDepositDayData === null){
        stakeDepositDayData = new StakeDepositDayData(ID)
        stakeDepositDayData.pid = pid
        fetchPoolInfo(event.address,pid)
        stakeDepositDayData.date =  BigInt.fromI32(timestamp)
    }
    stakeDepositDayData.save()
    return stakeDepositDayData as StakeDepositDayData
}

export function updateWithdrawDay(event:Withdraw):StakeWithdrawDayData{
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    // let dayStartTimestamp = dayID * 86400;
    let pid = event.params.pid
    let ID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString()).concat("-").concat(pid.toString());

    let stakeWithdrawDayData = StakeWithdrawDayData.load(ID)
    if (stakeWithdrawDayData === null){
        stakeWithdrawDayData = new StakeWithdrawDayData(ID)
        stakeWithdrawDayData.pid = pid
        fetchPoolInfo(event.address,pid)
        stakeWithdrawDayData.date = BigInt.fromI32(timestamp)
    }
    stakeWithdrawDayData.save()
    return stakeWithdrawDayData as StakeWithdrawDayData
}

export function updateEmergencyWithdrawDay(event:EmergencyWithdraw):StakeEmergencyWithdrawDayData{
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    // let dayStartTimestamp = dayID * 86400;
    let pid = event.params.pid
    let ID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString()).concat("-").concat(pid.toString());
    let stakeEmergencyWithdrawDayData = StakeEmergencyWithdrawDayData.load(ID)
    if(stakeEmergencyWithdrawDayData === null){
        stakeEmergencyWithdrawDayData = new StakeEmergencyWithdrawDayData(ID)
        stakeEmergencyWithdrawDayData.pid = pid
        fetchPoolInfo(event.address,pid)
        stakeEmergencyWithdrawDayData.date = BigInt.fromI32(timestamp)
    }
    stakeEmergencyWithdrawDayData.save()
    return stakeEmergencyWithdrawDayData as StakeEmergencyWithdrawDayData
}
//调用合约方法查询PoolInfo
export function fetchPoolInfo(address:Address,pid:BigInt):void{
    let fairLaunch = FairLaunch.bind(address)
    let poolInfo = fairLaunch.try_poolInfo(pid)
    if (!poolInfo.reverted){
        let poolInfos = PoolInfoDtat.load(pid.toString())
        if (poolInfos === null){
            poolInfos = new PoolInfoDtat(pid.toString())
        }
        poolInfos.stakeToken = poolInfo.value.value0
        poolInfos.allocPoint = poolInfo.value.value1
        poolInfos.lastRewardBlock = poolInfo.value.value2
        poolInfos.accAlpacaPerShare = poolInfo.value.value3
        poolInfos.accAlpacaPerShareTilBonusEnd = poolInfo.value.value4
        poolInfos.save()
    }

}