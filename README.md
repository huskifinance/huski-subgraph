# HuskiFinance Subgraph

----
TheGraph exposes a GraphQL endpoint to query the events and entities within the HuskiFinance ecosystem.

## Subgraphs

----
1. **Vault**: Tracks HuskiFinance Vault

## Dependencies

----
- [Graph CLI](https://github.com/graphprotocol/graph-cli)
    - Required to generate and build local GraphQL dependencies.

```shell
yarn global add @graphprotocol/graph-cli
```
## Deployment

For any of the subgraph: `blocks` as `[subgraph]`

1. Run the `cd subgraphs/[subgraph]` command to move to the subgraph directory.

2. Run the `yarn codegen` command to prepare the TypeScript sources for the GraphQL (generated/*).

3. Run the `yarn build` command to build the subgraph, and check compilation errors before deploying.

4. Deploy via `yarn deploy`.