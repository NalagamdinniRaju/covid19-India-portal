const express = require("express");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertStateObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authorization = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userNameDetailsQuery = `
        SELECT 
            *
        FROM 
            user
        WHERE 
            username = '${username}';
    `;
  const usernameDetailsResponse = await db.get(userNameDetailsQuery);

  if (usernameDetailsResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      usernameDetailsResponse.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authorization, async (request, response) => {
  const statesDetailsQuery = `
        SELECT 
            *
        FROM
            state;
    `;
  const statesDetailsResponse = await db.all(statesDetailsQuery);
  response.send(
    statesDetailsResponse.map((eachState) =>
      convertStateObjectToResponseObject(eachState)
    )
  );
});

// API 3
app.get("/states/:stateId/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStateIdDetailsQuery = `
        SELECT 
            *
        FROM
            state
        WHERE 
            state_id = ${stateId};
    `;
  const getStateIdDetailsResponse = await db.get(getStateIdDetailsQuery);
  response.send(convertStateObjectToResponseObject(getStateIdDetailsResponse));
});

//API 4
app.post("/districts/", authorization, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictDetailsQuery = `
        INSERT INTO 
            district (district_name, state_id, cases, cured, active, deaths)
        VALUES
            ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');
    `;
  await db.run(postDistrictDetailsQuery);
  response.send("District Successfully Added");
});

//API 5
app.get("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictDetails = `
        SELECT 
            *
        FROM
            district
        WHERE 
            district_id = ${districtId};
    `;
  const districtDetailsResponse = await db.get(getDistrictDetails);
  response.send(convertDistrictObjectToResponseObject(districtDetailsResponse));
});

//API 6
app.delete(
  "/districts/:districtId/",
  authorization,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictDetails = `
        DELETE FROM 
            district
        WHERE 
            district_id = ${districtId};
    `;
    await db.run(deleteDistrictDetails);
    response.send("District Removed");
  }
);

//API 7
app.put("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictDetails = `
        UPDATE 
            district
        SET 
                district_name = '${districtName}',
                state_id = ${stateId},
                cases = ${cases},
                cured = ${cured},
                active = ${active},
                deaths = ${deaths}
            
        WHERE 
            district_id = ${districtId};

    `;
  await db.run(updateDistrictDetails);
  response.send("District Details Updated");
});

// API 8
app.get("/states/:stateId/stats/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const getStatesDetailsQuery = `
        SELECT 
            SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(active) as totalActive,
            SUM(deaths) as totalDeaths
        FROM
            district
        WHERE 
            state_id = ${stateId};
    `;
  const getTotalStateDetailsResponse = await db.get(getStatesDetailsQuery);
  response.send(getTotalStateDetailsResponse);
});
module.exports = app;
