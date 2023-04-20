#!/usr/bin/env python3
from flask import Flask, request, make_response, json, jsonify
import requests
import re
import io
from os import urandom, listdir
import os
from sys import argv, stderr, exit
from web3 import Web3, IPCProvider
from web3.middleware import geth_poa_middleware
import string
app = Flask(__name__)

hash_pattern = re.compile(r"0x[0-9a-fA-F]{64}")

try:
    ipc_path = "~/blockchain-iua/bfatest/node/geth.ipc"
    w3 = Web3(IPCProvider(ipc_path))
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
except:
    print("Error conectandose con el archivo geth.ipc")

# Leemos el archivo Stamper.json para obtener la ABI y la dirección del contrato.
with open('Stamper.json') as f:
    config = json.load(f)
    abi = config['abi']
    address = config['networks']['55555000000']['address']

# Creamos una instancia del contrato Stamper utilizando la ABI y la dirección.
contract = w3.eth.contract(address=address, abi=abi)

def is_valid_hash(h):
    return re.match(hash_pattern, h)


@app.get("/stamped/<hash_value>")
def stamped(hash_value):
    #verificamos si el hash es valido
    if is_valid_hash(hash_value):
        result = contract.functions.stamped(hash_value).call()
        if result[1]!=0:
            response = jsonify(signer = result[0], blockNumber = result[1])
            response.status_code = 200
        else: 
            response = jsonify(message= "Hash not found")
            response.status_code = 404
    else:
        response = jsonify(message =  "Invalid hash format")
        response.status_code = 400
    return response


@app.post("/stamp")
def stamp():
    if request.mimetype == "application/json":
        req = request.json
        hash_value = req.get("hash")
        #verificamos si el hash es valido
        if is_valid_hash(hash_value):
            stamped = contract.functions.stamped(hash_value).call()
            if stamped:
                #verificamos si el hash aun no fue estampado
                if(stamped[1] == 0):
                    #obtenemos el signature
                    signature = req.get("signature")
                    #si hay signature llamo a stampSigned
                    if signature:
                        transaction = contract.functions.stampSigned(hash_value, signature).build_transaction({
                            'nonce': w3.eth.get_transaction_count(sender),
                            'gas': 100000,
                            'gasPrice': w3.eth.gas_price,
                    })
                    #si no hay signature llamo a stamp
                    else:
                        transaction = contract.functions.stamp(hash_value).build_transaction({
                            'nonce': w3.eth.get_transaction_count(sender),
                            'gas': 100000,
                            'gasPrice': w3.eth.gas_price,
                    })

                    #intento incluir la transaccion en la blockchain
                    try:
                        signed_transaction = w3.eth.account.sign_transaction(transaction=transaction, private_key=private_key)
                        transaction_hash = w3.eth.send_raw_transaction(signed_transaction.rawTransaction)
                        transaction_receipt = w3.eth.wait_for_transaction_receipt(transaction_hash)
                    #si la transaccion falla
                    except Exception as e:
                        response = jsonify(message = f"Transaction failed: {e}")
                        response.status_code = 400
                        return response
                    #si pudo agregarse correctamente
                    if transaction_receipt.status == 1:
                        response = jsonify(transaction = transaction, blockNumber =  transaction_receipt.blockNumber)
                        response.status_code = 201
                        return response
                    #si no pudo agregarse
                    else:
                        response = jsonify(message = f"Transaction failed")
                        response.status_code = 400
                        return response
        else:
            response = jsonify(message = "Invalid hash")
            response.status_code = 400
            return response
    else:
        response = jsonify(message = f"Invalid message mimetype: '{request.mimetype}'")
        response.status_code = 400
    return response
       
       

if __name__ == '__main__':

    # Pedimos la contraseña para descifrar la clave privada de la primera cuenta del keystore.
    password = input('Ingrese la contraseña de la primera cuenta del keystore: ')

    # Obtenemos el keystore file
    keystore_dir = os.path.expanduser("~/.ethereum/keystore")
    keystore = list(map(lambda f: os.path.join(keystore_dir, f), sorted(listdir(keystore_dir))))

    # Obtenemos la cuenta del keystore
    with open(keystore[0]) as f:
        sender = f"0x{json.load(f)['address']}"
    # tranform the sender to a checksum address
    sender = w3.to_checksum_address(sender)

    # Desciframos la clave privada de la primera cuenta del keystore
    with open(keystore[0]) as f:
        encrypted_key = f.read()
    try:
        private_key = w3.eth.account.decrypt(encrypted_key, password)
    except ValueError:
        print("Invalid password")
        exit(1)

    app.run()
