const hub = "https://demos.ia.oraclecorp.com/74/"
const apiuser = "<YOURINTELLIGENTADVISORAPIUSERNAME>";
const apiuserPassword = "<YOURINTELLIGENTADVISORAPIPASSWORD>";

let bearerToken;

export async function getBearerToken() {
    const req = await fetch(hub + "opa-hub/api/12.2.23/auth", {
        method: "POST",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=client_credentials&client_id=${apiuser}&client_secret=${apiuserPassword}`
    });
    const json = await req.json();
    bearerToken = json.access_token;
    return bearerToken;
}

export async function callDecisionService(service, input) {
    const req = await fetch(hub + "determinations-server/v2/" + service, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`
        },
        body: JSON.stringify(input)
    });

    if (req.status != 200) {
        throw new Error("decision service failed");
    }

    const json = await req.json();
    return json;
}