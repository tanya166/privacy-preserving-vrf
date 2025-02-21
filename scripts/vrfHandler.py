from py_ecc import bn128
import hashlib
import json

def generate_vrf_key():
    private_key = bn128.G1
    public_key = bn128.multiply(private_key, 2)  # Just an example key derivation
    return private_key, public_key

def compute_vrf(data, private_key):
    hashed_data = hashlib.sha256(json.dumps(data).encode()).hexdigest()
    proof = bn128.multiply(private_key, int(hashed_data, 16))
    return proof

# Example usage
private_key, public_key = generate_vrf_key()
data_segment = {"temperature": 25.3, "humidity": 80}
fingerprint = compute_vrf(data_segment, private_key)
print(f"VRF Fingerprint: {fingerprint}")
