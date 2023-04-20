#!/usr/bin/env python3
import argparse
from sys import exit, stderr
import os
import json
import subprocess

from web3 import Web3,IPCProvider
from web3.middleware import geth_poa_middleware
from web3.gas_strategies.rpc import rpc_gas_price_strategy
from eth_account import Account
from pathlib import Path

DEFAULT_WEB3_URI = "~/blockchain-iua/bfatest/node/geth.ipc"

def balance(account, unit):
    """Imprime el balance de una cuenta

    :param account: La dirección de la cuenta
    :param unit: Las unidades en las que se desea el resultado. (wei, Kwei, Mwei, Gwei, microether, milliether, ether)
    """
    try:
        balance = web3.from_wei(web3.eth.get_balance(account), unit)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

def transfer(src, dst, amount, unit, password):
    """Transfiere ether de una cuenta a otra.

    :param src: La dirección de la cuenta de origen.
    :param dst: La dirección de la cuenta de destino.
    :param amount: Monto que se desea transferir.
    :param unit: Unidades en las que está expresado el monto.
    Si la transacción es exitosa, imprime "Transferencia exitosa".
    Si la transacción falla, termina el programa con error e indica la causa.
    """
    web3.eth.set_gas_price_strategy(rpc_gas_price_strategy)
    
    directory = os.path.expanduser('~')+"/blockchain-iua/bfatest/node/keystore"
    keystore_file = find_keystore_file(directory, src)
    
    pkey = web3.eth.account.decrypt(keystore_file, password)
    
    try:
        value = web3.to_wei(amount, unit)
    except Exception as e:
        print(f"Error: {e}", file=stderr)
        exit(1)

    transaction = {
    'from': src,
    'to': dst,
    'value': value,
    'gas': web3.eth.estimate_gas({'from': src, 'to': dst, 'value': value}),
    'gasPrice': web3.eth.generate_gas_price(),
    'nonce': web3.eth.get_transaction_count(src),
    'chainId': web3.eth.chain_id
    }

    try:
        signed_transaction = web3.eth.account.sign_transaction(transaction,pkey) #firmar la transaccion
        hash_transaction = web3.eth.send_raw_transaction(signed_transaction.rawTransaction) #firmar enviar la transaccion
        print("Esperando a que la transaccion se incluya a un bloque...")
        receipt_transaction = web3.eth.wait_for_transaction_receipt(hash_transaction) #esperar a que se escriba en un bloque
    except Exception as e:
        print(f"Error: {e}", file=stderr)
        exit(1)
    
    if receipt_transaction.status == 1:
        print(f"Transferencia exitosa. Hash de transaccion: ", {hash_transaction})
    else:
        print(f"Error: La transacción falló")
        exit(1)


def accounts():
    accounts = web3.eth.accounts
    print(f'Cuentas asociadas con el nodo: {accounts}')

def address(x):
    """Verifica si su argumento tiene forma de dirección ethereum válida"""
    
    if x[:2] == '0x' or x[:2] == '0X':
        try:
            b = bytes.fromhex(x[2:])
            if len(b) == 20:
                return x
        except ValueError:
            pass
    raise argparse.ArgumentTypeError(f"Invalid address: '{x}'")         

def find_keystore_file(directory, address):
    for filename in os.listdir(directory):
        with open(os.path.join(directory, filename), 'r') as f:
                data = f.read()
                if "address" in data:
                    return data
    return None                                                                                                                                      



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=
        f"""Maneja los fondos de una cuenta en una red ethereum.
        Permite consultar el balance y realizar transferencias. Por defecto, intenta conectarse mediante '{DEFAULT_WEB3_URI}'""")
    parser.add_argument("--uri", help=f"URI para la conexión con geth",default=DEFAULT_WEB3_URI)
    subparsers = parser.add_subparsers(title="command", dest="command")
    subparsers.required=True
    parser_balance = subparsers.add_parser("balance", help="Obtiene el balance de una cuenta")
    parser_balance.add_argument("--unit", help="Unidades en las que está expresado el monto", choices=['wei', 'Kwei', 'Mwei', 'Gwei', 'microether', 'milliether','ether'], default='wei')
    parser_balance.add_argument("--account", "-a", help="Cuenta de la que se quiere obtener el balance", type=address, required=True)
    parser_transfer = subparsers.add_parser("transfer", help="Transfiere fondos de una cuenta a otra")
    parser_transfer.add_argument("--from", help="Cuenta de origen", type=address, required=True, dest='src')
    parser_transfer.add_argument("--to", help="Cuenta de destino", type=address, required=True, dest='dst')
    parser_transfer.add_argument("--amount", help="Monto a transferir", type=int, required=True)
    parser_transfer.add_argument("--unit", help="Unidades en las que está expresado el monto", choices=['wei', 'Kwei', 'Mwei', 'Gwei', 'microether', 'milliether','ether'], default='wei')
    parser_accounts = subparsers.add_parser("accounts", help="Lista las cuentas de un nodo")
    args = parser.parse_args()
    
    web3 = Web3(IPCProvider(args.uri))
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)
    
    # La URI elegida por el usuario está disponible como args.uri
    # Lo que sigue probablemente debería estar encerrado en un bloque try: ... except:
    if args.command == "balance":
        balance(args.account, args.unit)
    elif args.command == "transfer":
        transfer(args.src, args.dst, args.amount, args.unit)
    elif args.command == "accounts":
        accounts()
    else:
        print(f"Comando desconocido: {args.command}", file=stderr)
        exit(1)