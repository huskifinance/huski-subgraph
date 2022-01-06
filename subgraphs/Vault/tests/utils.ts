import { Transfer } from "../generated/Vault/Vault";
import { newMockEvent } from "matchstick-as/assembly/index"
import { Address, ethereum } from "@graphprotocol/graph-ts";


export function createTransferEvent(toAddress: string,fromAddress: string, value: i32): Transfer {
  const mockEvent = newMockEvent()
  const transferEvent = new Transfer(mockEvent.address, mockEvent.logIndex, mockEvent.transactionLogIndex,
    mockEvent.logType, mockEvent.block, mockEvent.transaction, mockEvent.parameters)
  // transferEvent.parameters = new Array()

  const toParam = new ethereum.EventParam("to",ethereum.Value.fromAddress(Address.fromString(toAddress)))
  const fromParam = new ethereum.EventParam("from",ethereum.Value.fromAddress(Address.fromString(fromAddress)))
  const valueParam = new ethereum.EventParam("value",ethereum.Value.fromI32(value))

  transferEvent.parameters.push(toParam)
  transferEvent.parameters.push(fromParam)
  transferEvent.parameters.push(valueParam)

  return transferEvent
}