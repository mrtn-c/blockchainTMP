import requests
import pytest
from os import urandom
from jsonschema import validate
from web3 import Web3

stamped_200_schema = {
    "type": "object",
    "properties": {
        "signer": {"type": "string"},
        "blockNumber": {
            "anyOf": [
                {"type": "number"},
                {"type": "string"}
            ]
        },
    },
    "required": ["signer", "blockNumber"]
}

stamp_201_schema = {
    "type": "object",
    "properties": {
        "transaction": {"type": "string"},
        "blockNumber": {
            "anyOf": [
                {"type": "number"},
                {"type": "string"}
            ]
        },
    },
    "required": ["transaction", "blockNumber"]
}

stamp_403_schema = {
    "type": "object",
    "properties": {
        "message": {"type": "string"},
        "signer": {"type": "string"},
        "blockNumber": {
            "anyOf": [
                {"type": "number"},
                {"type": "string"}
            ]
        },
    },
    "required": ["signer", "blockNumber", "message"]
}

error_4XX_schema = {
    "type": "object",
    "properties": {
        "message": {"type": "string"},
    },
    "required": ["message"]
}


server = "http://localhost:5000"
application_json = "application/json"


def stamped(h):
    return f"{server}/stamped/{h}"


stamp = f"{server}/stamp"


def random_hash():
    return f"0x{urandom(32).hex()}"


def random_invalid_hash_and_signature():
    from eth_account import Account
    h = random_hash()
    while True:
        s = urandom(65)
        if s[-1] == b'\x1b' or s[-1] == b'\x1c':
            continue
        try:
            Account.recoverHash(h, s)
        except Exception:
            return (h, f"0x{s.hex()}")


def test_invalid_mimetype():
    response = requests.post(stamp, data={"hash": random_hash()})
    assert response.status_code == 400


def test_stamped_invalid_hash():
    response = requests.get(stamped(1234))
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 400)
    validate(instance=response.json(), schema=error_4XX_schema)
    response = requests.get(stamped("aaaaa"))
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 400)
    validate(instance=response.json(), schema=error_4XX_schema)
    response = requests.get(stamped("0x01"))
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 400)
    validate(instance=response.json(), schema=error_4XX_schema)


def test_stamped_unstamped_hash():
    for _ in range(10):
        response = requests.get(stamped(random_hash()))
        assert (application_json in response.headers['Content-type'])
        assert (response.status_code == 404)
        validate(instance=response.json(), schema=error_4XX_schema)


def test_stamped_known_hash():
    hashes = [
        ('0x836a97e0ff6a85dd2746a39ed71171595759c02beda2d45d0280e0cd19ba3c34',
         '0xe694177c2576f6644Cbd0b24bE32a323f88A08D5', 10297664),
        ('0xc2b9b625616ee8d3c0b54c417dd691647d07582c92f3f9c8caf7d594915086d6',
         '0x03c1AC114AE78F3a1edFAE95E4BDE984dE69Ae2b', 10297687),
        ('0x04924fbda3a29383422efde5dfa0e03914e18080767e13935b6e130ebc847275',
         '0x313901c1B3cacbDc19D6f67D4845Bf01540Ee9A6', 10297728)
    ]
    for hash_value, signer, block_number in hashes:
        response = requests.get(stamped(hash_value))
        assert (application_json in response.headers['Content-type'])
        assert (response.status_code == 200)
        r = response.json()
        validate(instance=r, schema=stamped_200_schema)
        assert r["signer"] == signer
        assert r["blockNumber"] == block_number


def test_stamp():
    hash_value = random_hash()
    response = requests.post(stamp, json={"hash": hash_value})
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 201)
    r = response.json()
    validate(instance=r, schema=stamp_201_schema)
    block_number = r["blockNumber"]
    response = requests.get(stamped(hash_value))
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 200)
    r = response.json()
    validate(instance=r, schema=stamped_200_schema)
    assert (r["blockNumber"] == block_number)
    signer = r["signer"]
    response = requests.post(stamp, json={"hash": hash_value})
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 403)
    r = response.json()
    validate(instance=r, schema=stamp_403_schema)
    assert (r["blockNumber"] == block_number)
    assert (r["signer"] == signer)


def test_stamp_signed():
    from eth_account import Account
    from eth_account.messages import encode_defunct
    acct = Account.create(urandom(16))
    hash_value = random_hash()
    msg = encode_defunct(hexstr=hash_value)
    signed = acct.sign_message(msg)
    signature = signed.signature.hex()
    response = requests.post(
        stamp, json={"hash": hash_value, "signature": signature})
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 201)
    r = response.json()
    validate(instance=r, schema=stamp_201_schema)
    block_number = r["blockNumber"]
    response = requests.get(stamped(hash_value))
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 200)
    r = response.json()
    validate(instance=r, schema=stamped_200_schema)
    assert (r["signer"] == acct.address and r["blockNumber"] == block_number)
    response = requests.post(stamp, json={"hash": hash_value})
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 403)
    validate(instance=response.json(), schema=stamp_403_schema)
    response = requests.post(
        stamp, json={"hash": hash_value, "signature": signature})
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 403)
    validate(instance=response.json(), schema=stamp_403_schema)


@pytest.mark.filterwarnings("ignore:recoverHash")
def test_invalid_signature():
    hash_value, signature = random_invalid_hash_and_signature()
    response = requests.post(
        stamp, json={"hash": hash_value, "signature": signature})
    assert (application_json in response.headers['Content-type'])
    assert (response.status_code == 400)
    r = response.json()
    validate(instance=r, schema=error_4XX_schema)
