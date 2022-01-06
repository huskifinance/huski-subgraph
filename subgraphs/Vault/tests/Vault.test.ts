import {assert,test} from "matchstick-as/assembly/index"
import { TransferData } from "../generated/schema"
import { ethereum } from "@graphprotocol/graph-ts";

test("Can use entity.load() to retrieve entity from store",()=> {
  const transferData = new TransferData("transferDataId0")
  transferData.save()

  const retrievedTransfer = TransferData.load("transferDataId0")
  assert.equals(ethereum.Value.fromString("transferDataId0"),ethereum.Value.fromBoolean(retrievedTransfer == null))
})