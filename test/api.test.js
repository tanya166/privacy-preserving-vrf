const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../backend/server"); 

chai.use(chaiHttp);
const { expect } = chai;

describe("API Tests", () => {
    it("Should store and retrieve VRF fingerprint", (done) => {
        chai.request(server) 
            .post("/process-data")
            .send({ segmentData: { temperature: 26.5, humidity: 80 } })
            .end((err, res) => {
                if (err) console.error("Error:", err.response ? err.response.body : err);
                expect(res).to.have.status(200);
                expect(res.body).to.have.property("segmentHash");
                expect(res.body).to.have.property("fingerprint");
                done();
            });
            
    });

    it("Should verify a stored fingerprint", (done) => {
        chai.request(server) 
            .get("/verify?segmentHash=segment1")
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body.verified).to.be.true;
                done();
            });
    });
});
