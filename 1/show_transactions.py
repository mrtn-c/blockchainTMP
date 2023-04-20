#!/usr/bin/env python3
from web3 import Web3,IPCProvider
from web3.middleware import geth_poa_middleware
"""Este programa muestra las transacciones ocurridas en un determinado rango de bloques,
eventualmente restringidas a las que corresponden a una o más direcciones.
Sólo deben considerarse las transacciones que implican transferencia de ether.
Los bloques analizados son todos aquellos comprendidos entre los argumentos first-block
y last-block, ambos incluidos.
Si se omite first-block, se comienza en el bloque 0.
Si se omite last-block, se continúa hasta el último bloque.
Se pueden especificar una o más direcciones para restringir la búsqueda a las transacciones
en las que dichas direcciones son origen o destino.
Si se especifica la opción add, cada vez que se encuentra una transacción que responde a
los criterios de búsqueda, se agregan las cuentas intervinientes a la lista de direcciones
a reportar.
La opción "--short" trunca las direcciones a los 8 primeros caracteres.
La salida debe producirse en al menos los dos formatos siguientes:
'plain': <origen> -> <destino>: <monto> (bloque)
'graphviz': Debe producir un grafo representable por graphviz. Ejemplo (con opcion --short)
digraph Transfers {
"8ffD013B" -> "9F4BA634" [label="1 Gwei (1194114)"]
"8ffD013B" -> "9F4BA634" [label="1 ether (1194207)"]
"9F4BA634" -> "8ffD013B" [label="1 wei (1194216)"]
"8ffD013B" -> "46e2a9e9" [label="2000 ether (1195554)"]
"8ffD013B" -> "8042435B" [label="1000 ether (1195572)"]
"8042435B" -> "8ffD013B" [label="1 ether (1195584)"]
"8ffD013B" -> "55C37a7E" [label="1000 ether (1195623)"]
"8ffD013B" -> "fD52f36a" [label="1000 ether (1195644)"]
}
"""

def address(x):
    """Verifica si su argumento tiene forma de dirección ethereum válida"""
    
    if x[:2] == '0x' or x[:2] == '0X':
        try:
            b = bytes.fromhex(x[2:])
            if len(b) == 20:
                return x
        except ValueError:
            pass
    raise argparse.ArgumentTypeError(f"Invalid address: '{x}'")     #LISTO ESTO.                                                                                                                                          



if __name__ == '__main__':
    import argparse
    DEFAULT_WEB3_URI = "~/blockchain-iua/bfatest/node/geth.ipc"
    parser = argparse.ArgumentParser()
    parser.add_argument("addresses", metavar="ADDRESS", type=address, nargs='*', help="Direcciones a buscar")
    parser.add_argument("--add",help="Agrega las direcciones encontradas a la búsqueda", action="store_true", default=False)
    parser.add_argument("--first-block", "-f", help="Primer bloque del rango en el cual buscar", type=int, default=0)
    parser.add_argument("--last-block", "-l", help="Último bloque del rango en el cual buscar", type=int, default=-1)
    parser.add_argument("--format", help="Formato de salida", choices=["plain","graphviz"], default="plain")
    parser.add_argument("--short", help="Trunca las direcciones a los 8 primeros caracteres", action="store_true")
    parser.add_argument("--uri", help=f"URI para la conexión con geth",default=DEFAULT_WEB3_URI)
    args = parser.parse_args()

#conexion al nodo
    web3 = Web3(IPCProvider(args.uri))
    web3.middleware_onion.inject(geth_poa_middleware, layer=0)
    first_block = args.first_block
    last_block = args.last_block
    if last_block == -1:
        last_block = web3.eth.block_number #Returns the number of the most recent block
    
    addresses = []

    for block_number in range(first_block, last_block + 1):
        block = web3.eth.get_block(block_number, True) #Coloco el true para que me traiga toda la info. Si no seria solo el hash.
        
        for transaction in block.transactions:

            if args.add:
                if (transaction['from'] in args.addresses):
                    addresses.append(transaction['from'])
                elif(transaction['to'] in args.addresses):
                    addresses.append(transaction['to'])
            
            if transaction.value > 0 and (addresses == [] or transaction['from'] in addresses or transaction['to'] in addresses):

                origen = transaction['from']
                destino = transaction['to']
            
            unidad = '.'

            if(transaction.value >= 10**18):
                unidad='ether'
            elif(transaction.value >= 10**9) :
                unidad='Gwei'
            elif(transaction.value >= 10**6):
                unidad='Mwei'
            elif(transaction.value >= 10**3):
                unidad='Kwei'
            else:
                unidad='wei' 

            monto = Web3.from_wei(transaction.value, unidad)
                
                #si se pide el formato plain
            if args.format == "plain":
                print(f"{origen} -> {destino}: {monto} ether ({block_number})")




