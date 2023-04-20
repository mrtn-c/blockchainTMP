# Trabajo práctico 2

En la red de testeo de la BFA se encuentra desplegado un contrato en la dirección '0xA2e82b0666a291c53F374E34A6C09fBA873aB0f2'. Dicho contrato provee funcionalidades de sello de tiempo, y provee una interface equivalente a la siguiente:

```solidity
    struct Stamped {
        address signer;
        uint blockNumber;
    }

    function stamp(bytes32 hash) public;

    function stampSigned(bytes32 hash, bytes signature) public;

    function stamped(bytes32 hash) public returns (Stamped);
```
La interface está simplificada, pero responde a lo que puede verse externamente.

Su semántica es la siguiente:

* La función `stamp(bytes32 hash)`  es una transacción que recibe como argumento un *hash* de 256 bits y almacena, asociado con él, el emisor del mensaje y el número de bloque en el que se produjo la transacción. Si el *hash* ya ha sido registrado, produce un error y la transacción se revierte.
* La función `stampSigned(bytes32 hash, bytes signature)`  es una transacción que recibe como argumento un *hash* de 256 bits, y una firma de dicho hash, y almacena, asociado con hash, el firmante del mensaje y el número de bloque en el que se produjo la transacción. Si el *hash* ya ha sido registrado, produce un error y la transacción se revierte.
* La función `stamped(bytes32 hash)` es una llamada que recibe un *hash* de 256 bits, y devuelve la estructura `Stamped` asociada con ese hash. Si ese *hash* nunca ha sido registrado, devolverá una estructura con ambos valores con su valor _default_, es decir
    * `'0x0000000000000000000000000000000000000000'` para la dirección 
    * y `0` para el número de bloque.

La ABI y la dirección del contrato están definidas en el archivo [Stamper.json](Stamper.json). En dicho archivo se define un objeto con los siguientes campos:

* `contractName` define el nombre del contrato ("Stamper")
* `abi` contiene la ABI necesaria para interactuar con el contrato.
* `networks` contiene infomación del despliegue del contrato: Red, dirección y transacción de creación.

## Consigna
Implementar una API REST que interactúe con el contrato y permita acceder a sus funcionalidades. En la API los *hashes*, direcciones y transacciones se expresarán como cadenas hexadecimales de la longitud adecuada y el prefijo "0x". Los valores enteros se expresarán como números decimales. 
La API deberá trabajar con cuentas locales, es decir, debe poder interactuar con un nodo que no tiene definida ninguna cuenta. Se asume que hay al menos dos cuentas locales, con el formato de keystore de `geth`, y alojadas en el directorio `~/.ethereum/keystore`. 

La cuenta utilizada para interactuar con el nodo ethereum debe ser la primera del _keystore_ en orden lexicográfico (ello implica que es la más antigua). Esa cuenta poseerá `ether` suficiente como para realizar transacciones. Las otras cuentas pueden no tener `ether`.

El programa que implemente la API debe leer la primera cuenta del _keystore_, descifrar la clave privada y operar con ella. Para ello debe pedir la contraseña de descifrado al inicio de su ejecución, o recibir el nombre de un archivo con la contraseña como argumento de la línea de comandos.

La API debe proveer los siguientes *endpoints*:

### `/stamped/:hash`

* Método: `GET`
* Argumento: `:hash` corresponde a un *hash* de 256 bits.
* Retorno exitoso:
    * Código HTTP: 200
    * Cuerpo: Un objeto JSON con dos campos: `signer` y `blockNumber`, correspondientes a la dirección que ha registrado el *hash* y al número de bloque correspondiente a dicha transacción.
* Retorno fallido:
    * Codigo HTTP: 
        * Si el hash no ha sido registrado: `404 Not Found`
        * Si el argumento está mal formado: `400 Bad Request`
    * Cuerpo: Un objeto JSON con un campo `message` que contiene el mensaje de error.

### `/stamp`

* Método: `POST`
* Content-type: `application/json`
* Cuerpo: Un objeto JSON con un campo `hash`, que contiene el hash a registrar, y un campo opcional `signature`, que contiene una firma del hash. Si la firma está presente se llamará al método `stampSigned` del contrato, y si está ausente se invocará el método `stamp`.
* Retorno exitoso:
    * Código HTTP: 201
    * Cuerpo: Un objeto JSON con dos campos: `transaction` y `blockNumber`, correspondientes a la transacción en la que se ha registrado el *hash* y al número de bloque correspondiente a dicha transacción.
* Retorno fallido:
    * Codigo HTTP: 
        * Si el hash ya ha sido registrado: `403 Forbidden`
        * Si alguno de los argumentos está mal formado o el *content_type* del requerimiento no es `application/json': `400 Bad Request`
    * Cuerpo: Un objeto JSON con un campo `message` que contiene el mensaje de error. Si el error se debe a que el hash ya estaba registrado, se deben incluir además los campos `signer` y `blockNumber` con los valores correspondientes.

## Resolución del práctico

Debemos desarrollar un servidor que se comunique por un lado con un usuario, mediante la API REST, y por otro lado, con un contrato ya desplegado.

La interacción con un contrato se realiza en última instancia mediante transacciones que tienen como destino la dirección del contrato, pero las distintas bibliotecas nos proporcionan métodos que simplifican esta tarea. Los ejemplos que siguen corresponden a la biblioteca `web3` de Python, pero pueden adaptarse a otros lenguajes.

### Interacción con un contrato

Para interactuar con un contrato ya desplegado necesitamos dos elementos: su dirección y su ABI (*Application Binary Interface*), que define qué métodos provee el contrato, cuáles son sus argumentos y cuáles sus valores de retorno.

En este caso, ambos valores han sido provistos en el archivo `Stamper.json`. Una posible forma de construir un objeto que nos permita interactuar con el contrato es la siguiente:

```python
import json
with open('Stamper.json') as f:
    config = json.load(f)
contract = w3.eth.contract(abi = config['abi'], address = config["networks"]["55555000000"]["address"])
```

El objeto `contract` nos brinda una serie de métodos que nos permiten interactuar con el contrato. Debemos recordar que tenemos dos formas de interactuar con un contrato:

* Mediante *llamadas*, con las cuales hacemos consultas que no modifican el estado del contrato, no consumen gas y no tienen costo.
* Mediante *transacciones*, que modifican el estado del contrato, consumen gas y tienen un costo en ether que es pagado por quien invoca la transacción.

En el contrato `Stamper`, el método `stamped()` se invoca mediante una llamada, ya que simplemente nos indica si un determinado hash ha sido registrado en el contrato. Veamos un ejemplo:

```python
already_stamped = '0x836a97e0ff6a85dd2746a39ed71171595759c02beda2d45d0280e0cd19ba3c34'
contract.functions.stamped(already_stamped).call()
# ['0xe694177c2576f6644Cbd0b24bE32a323f88A08D5', 10297664]
```

La respuesta nos indica que ese hash ha sido registrado desde la dirección `0xe694177c2576f6644Cbd0b24bE32a323f88A08D5` en el bloque 10297664.

Por otra parte, el método `stamp()` es una transacción, y requiere ser invocado desde una cuenta con ether. Una forma de hacerlo es utilizando cuentas alojadas en el nodo:

```python
new_hash = os.urandom(32)
contract.functions.stamp(new_hash).transact()
# ValueError: {'code': -32000, 'message': 'unknown account'}
```

Necesitamos indicar una cuenta:

```python
new_hash = os.urandom(32)
contract.functions.stamp(new_hash).transact({'from': w3.eth.accounts[0]})
```

Otra forma de hacerlo es con claves privadas locales, firmando transacciones y enviando transacciones firmadas. Ese es el mecanismo que utilizaremos.

```python
transaction = contract.functions.stamp(new_hash).build_transaction({
    'gas': 100000,
    'gasPrice': w3.eth.gas_price,
    'nonce': w3.eth.get_transaction_count(account)
})
signed_transaction = w3.eth.account.sign_transaction(transaction, private_key = private_key)
w3.eth.send_raw_transaction(signed_transaction.rawTransaction)
```

Un inconveniente que tiene este mecanismo es que no sabemos de inmediato si la transacción se revirtió debido a un error. Podemos saber si la transacción fue exitosa analizando el recibo. Supongamos que repetimos la transacción que mostramos más arriba. La transacción debería fallar, ya que el hash ya ha sido registrado.

```python
transaction = contract.functions.stamp(new_hash).build_transaction({
    'gas': 100000,
    'gasPrice': w3.eth.gas_price,
    'nonce': w3.eth.get_transaction_count(account)
})
signed_transaction = w3.eth.account.sign_transaction(transaction, private_key = private_key)
txh = w3.eth.send_raw_transaction(signed_transaction.rawTransaction)
receipt = w3.eth.get_transaction_receipt(txh)
```

El contenido del recibo será algo similar a lo siguiente:

```python
AttributeDict({'blockHash': HexBytes('0xadd313d4ed887548c4116cd0c3d6175ff54c663da75314ef4e64d1e8b8aa1509'),
 'blockNumber': 19917226,
 'contractAddress': None,
 'cumulativeGasUsed': 64479,
 'effectiveGasPrice': 1000000000,
 'from': '0xf555994877943ca34B6E1218751BCC53837ecA6D',
 'gasUsed': 64479,
 'logs': [],
 'logsBloom': HexBytes('0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
 'status': 1,
 'to': '0xA2e82b0666a291c53F374E34A6C09fBA873aB0f2',
 'transactionHash': HexBytes('0x4d2d0d5711a347740aa769840b3a623cad1323476600cbea5d318749b7525cba'),
 'transactionIndex': 0,
 'type': 0})
```

 El valor 0 en `status` nos indica que la transacción ha fracasado. Pero no sabemos la causa. Para averiguar la causa, debemos invocar nuevamente la transacción con un `call()`.

 Podemos obtener la transacción a partir de su hash:

 ```python
 tx = w3.eth.get_transaction(txh)
 ```

 El resultado será algo así:

 ```python
 AttributeDict({'blockHash': HexBytes('0xadd313d4ed887548c4116cd0c3d6175ff54c663da75314ef4e64d1e8b8aa1509'),
 'blockNumber': 19917226,
 'from': '0xf555994877943ca34B6E1218751BCC53837ecA6D',
 'gas': 100000,
 'gasPrice': 1000000000,
 'hash': HexBytes('0x4d2d0d5711a347740aa769840b3a623cad1323476600cbea5d318749b7525cba'),
 'input': '0xdd89581f51e2298647465d30b801b1a4f245ed255b9070e6c995a3419cf098783be8d878',
 'nonce': 8,
 'to': '0xA2e82b0666a291c53F374E34A6C09fBA873aB0f2',
 'transactionIndex': 0,
 'value': 0,
 'type': 0,
 'v': 198237680,
 'r': HexBytes('0xbe7ce6068024e0c4ecde2e92b8b869ed2ab6b75be7aadb1cbd96f0a4c1821541'),
 's': HexBytes('0x040ad9d720d11eb7e339cd18ec3d38ae97d3d6d017690fe427f96b028ca09a77')})
```

El resultado es del tipo `AttributeDict`, utilizado por web3, y varios campos son de tipo `HexBytes`. Necesitamos convertirlo en un diccionario en el que todos los valores de tipo  `HexBytes` sean cadenas hexadecimales. Podemos lograr esto serializando la transacción en JSON, y deserializando el resultado.

Así, podemos ejecutar:

```python
w3.eth.call(json.loads(w3.to_json(tx)), tx.blockNumber)
```
Esta llamada fracasará con el mismo error que la transacción original:

```
ContractLogicError: execution reverted: The hash is already stamped
```

