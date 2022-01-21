import {Deposit, DepositCall, EmergencyWithdraw, FairLaunch, Withdraw} from "../generated/FairLaunch/FairLaunch";
import {
    // DepositCallData,
    PoolInfoDtat,
    DepositData,
    DepositDayData,
    EmergencyWithdrawData, EmergencyWithdrawDayData,
    WithdrawData, WithdrawDayData
} from "../generated/schema";
import {Address, BigInt} from "@graphprotocol/graph-ts";

export function handleDeposit(event:Deposit):void{
    let depositData = new DepositData(event.transaction.hash.toHex())
    depositData.block = event.block.number
    depositData.transactionHash = event.transaction.hash
    depositData.pid = event.params.pid
    depositData.user = event.params.user
    depositData.amount = event.params.amount
    let depositDayData = updateDepositDayData(event)
    let amount = depositDayData.amount
    if (amount !== null){
        depositDayData.amount = amount.plus(event.params.amount)
    }else {
        depositDayData.amount = event.params.amount
    }
    depositData.save()
    depositDayData.save()
}

export function handleWithdraw(event:Withdraw):void{
    let withdrawData = new WithdrawData(event.transaction.hash.toHex())
    withdrawData.block = event.block.number
    withdrawData.transactionHash = event.transaction.hash
    withdrawData.pid = event.params.pid
    withdrawData.user = event.params.user
    withdrawData.amount = event.params.amount
    let withdrawDayData = updateWithdrawDay(event)
    let amount = withdrawDayData.amount
    if (amount !== null){
        withdrawDayData.amount = amount.plus(event.params.amount)
    }else {
        withdrawDayData.amount = event.params.amount
    }
    withdrawData.save()
    withdrawDayData.save()
}

export function handleEmergencyWithdraw(event:EmergencyWithdraw):void{
    let emergencyWithdrawData = new EmergencyWithdrawData(event.transaction.hash.toHex())
    emergencyWithdrawData.block = event.block.number
    emergencyWithdrawData.transactionHash = event.transaction.hash
    emergencyWithdrawData.pid = event.params.pid
    emergencyWithdrawData.user = event.params.user
    emergencyWithdrawData.amount = event.params.amount
    let emergencyWithdrawDayData = updateEmergencyWithdrawDay(event)
    let amount = emergencyWithdrawDayData.amount
    if (amount !== null){
        emergencyWithdrawDayData.amount = amount.plus(event.params.amount)
        fetchPoolInfo(event.address,event.params.pid)
    }else {
        emergencyWithdrawDayData.amount = event.params.amount
    }
    emergencyWithdrawDayData.save()
    emergencyWithdrawData.save()
}

export function updateDepositDayData(event:Deposit):DepositDayData{
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    // let dayStartTimestamp = dayID * 86400;
    let pid = event.params.pid
    let ID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString()).concat("-").concat(pid.toString());

    let depositDayData =DepositDayData.load(ID)
    if (depositDayData === null){
        depositDayData = new DepositDayData(ID)
        depositDayData.pid = pid
        fetchPoolInfo(event.address,pid)
        depositDayData.date =  BigInt.fromI32(timestamp)
    }
    depositDayData.save()
    return depositDayData as DepositDayData
}

export function updateWithdrawDay(event:Withdraw):WithdrawDayData{
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    // let dayStartTimestamp = dayID * 86400;
    let pid = event.params.pid
    let ID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString()).concat("-").concat(pid.toString());

    let withdrawDayData = WithdrawDayData.load(ID)
    if (withdrawDayData === null){
        withdrawDayData = new WithdrawDayData(ID)
        withdrawDayData.pid = pid
        fetchPoolInfo(event.address,pid)
        withdrawDayData.date = BigInt.fromI32(timestamp)
    }
    withdrawDayData.save()
    return withdrawDayData as WithdrawDayData
}

export function updateEmergencyWithdrawDay(event:EmergencyWithdraw):EmergencyWithdrawDayData{
    let timestamp = event.block.timestamp.toI32();
    let dayID = timestamp / 86400;
    // let dayStartTimestamp = dayID * 86400;
    let pid = event.params.pid
    let ID = event.address.toHex().concat("-").concat(BigInt.fromI32(dayID).toString()).concat("-").concat(pid.toString());
    let emergencyWithdrawDayData = EmergencyWithdrawDayData.load(ID)
    if(emergencyWithdrawDayData === null){
        emergencyWithdrawDayData = new EmergencyWithdrawDayData(ID)
        emergencyWithdrawDayData.pid = pid
        fetchPoolInfo(event.address,pid)
        emergencyWithdrawDayData.date = BigInt.fromI32(timestamp)
    }
    emergencyWithdrawDayData.save()
    return emergencyWithdrawDayData as EmergencyWithdrawDayData
}

export function fetchPoolInfo(address:Address,pid:BigInt):void{
    let fairLaunch = FairLaunch.bind(address)
    let poolInfo = fairLaunch.try_poolInfo(pid)
    if (poolInfo.reverted){
        return
    }

    let poolInfos = PoolInfoDtat.load(pid.toString())
    if (poolInfos === null){
        poolInfos = new PoolInfoDtat(pid.toString())
    }
    poolInfos.stakeToken = poolInfo.value.value1
    poolInfos.allocPoint = poolInfo.value.value2
    poolInfos.lastRewardBlock = poolInfo.value.value3
    poolInfos.accHuskiPerShare = poolInfo.value.value4
    poolInfos.accHuskiPerShareTilBonusEnd = poolInfo.value.value5
    poolInfos.save()
}