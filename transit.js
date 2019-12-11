var transitData = {
	vehicles : [],
	routes : [],
	lines : [],
	stops : [],
	northSchedule : [],
	southSchedule : [],
	alerts : []
};

$(document).ready(function(){

	updateDate();

	getNorthAndSouthStationSchedules();

	getAlerts();

	setInterval(function(){  
		getNorthAndSouthStationSchedules();
		getAlerts();
		updateVehicles();
	}, 10000);

	setInterval(function(){  
		updateDate();
	}, 1000);

});

function updateDate(){
	let date = new Date();
	$("#currentDate").html(date.toLocaleDateString());
	$("#currentTime").html(date.toLocaleTimeString());
};

function updateVehicles(){
	const vehiclesUrl = "https://api-v3.mbta.com/vehicles";
	getData("vehicles", vehiclesUrl, ()=>{
		transitData.vehicles = getCommuterRailVehicles();
		fillTable();
	});
}

// function getNorthAndSouthStationStops(){
// 	const stopsUrl = "https://api-v3.mbta.com/stops";
// 	getData("stops", stopsUrl, ()=>{
// 		let southStationStops = $.grep(transitData.stops, (n,i)=>{ return n.id.includes("South Station") });
// 		let northStationStops = $.grep(transitData.stops, (n,i)=>{ return n.id.includes("North Station") });
// 		transitData.stops = {
// 			"southStation": southStationStops, 
// 			"northStation": northStationStops
// 		};
		
// 		updateVehicles(); //call initial updateVehicles call once we get the stops
// 	});
// }

function getNorthAndSouthStationSchedules() {
	const southUrl = "https://api-v3.mbta.com/schedules?filter%5Bstop%5D=South%20Station";
	getData("southSchedule", southUrl, ()=>{
		const northUrl = "https://api-v3.mbta.com/schedules?filter%5Bstop%5D=North%20Station";
		getData("northSchedule", northUrl, ()=>{
			//console.log(transitData.northSchedule);
			//console.log(transitData.southSchedule);
			updateVehicles(); //get the vehicles now that we have the schedules
		});
	});
}

function getAlerts(){
	const alertsUrl = "https://api-v3.mbta.com/alerts";
	getData("alerts", alertsUrl, ()=>{
		//todo?
	})
};

//TODO: put API key in env var
function getData(name, url, callback){
	$.ajax({
		url: url,
		type: "GET",
		dataType: "json",
		headers : {"x-api-key": "880fa0a5e9d04692823a25d99d519bec"}

	}).done(function(response){
		//console.log(name, response.data);
		transitData[name] = response.data;
		callback();
	});
}

function fillTable(){
	
	//console.log("Commuter Rail Vehicles: ", transitData.vehicles)

	//station, time, destination, train, track, status
	let tableHtml = `
		<tr>
			<th>Station</th>
			<th>Line</th>
			<th>Arrival Time</th>
			<th>Departure Time</th>
			<th>Destination</th>
			<th>Train #</th>
			<th>Track #</th>
			<th>Current Stop</th>
			<th>Status</th>
		</tr>
	`;
	
	for (i in transitData.vehicles) {

		//get arrival/departure time
		arrivalTime = "";
		departureTime = "";
		let tripId = transitData.vehicles[i].relationships.trip.data.id;
		//find schedule for south station
		let southIndex = transitData.southSchedule.findIndex(function(elt){
			return elt.relationships.trip.data.id == tripId;
		});
		//find schedule for north station
		let northIndex = transitData.northSchedule.findIndex(function(elt){
			return elt.relationships.trip.data.id == tripId;
		});
		if(northIndex !== -1) {
			arrivalTime = transitData.northSchedule[northIndex].attributes.arrival_time;
			departureTime = transitData.northSchedule[northIndex].attributes.departure_time;
		}

		//console.log("departure time", departureTime);

		if (arrivalTime && arrivalTime !=null) {
			arrivalTime = new Date(arrivalTime).toLocaleTimeString('en-US');
		}
		if (departureTime && departureTime !=null)  {
			departureTime = new Date(departureTime).toLocaleTimeString('en-US');
		}

		if (departureTime == null) departureTime = "";
		if (arrivalTime == null) arrivalTime = "";

		let station = "";
		northIndex == -1 ? station = "South Station" : station = "North Station";

		let line = transitData.vehicles[i].relationships.route.data.id;
		let destination = lookupDestination(line);
		let train = transitData.vehicles[i].attributes.label;
		
		let currentStop = transitData.vehicles[i].relationships.stop.data.id;
		let rawStopStatus = transitData.vehicles[i].attributes.current_status
		let stopStatus =  englishifyStopStatus(rawStopStatus) + " " + currentStop;
		//let alertStatus = "";
		let boardingStatus = checkDelays(tripId);

		//get track and boardingStatus;
		let track = "TBD";
		if (currentStop.includes("South Station") || currentStop.includes("North Station")) {
			//console.log("currentStop", currentStop)
			let parts = currentStop.split("-");
			track = parts[1] ? parts[1] : "";
			//console.log("parts", parts);
			boardingStatus = getBoardingStatus(rawStopStatus);
		}

		tableHtml += `
			<tr>
				<td>${station}</td> 	//station
				<td>${line}</td>
				<td>${arrivalTime}</td>	//arrival time
				<td>${departureTime}</td>	//departure time
				<td>${destination}</td>	//destination
				<td>${train}</td>	//train#
				<td>${track}</td>	//track#
				<td>${stopStatus}</td>	//stop status
				<td>${boardingStatus}</td> //boarding status
			</tr>
		`;
	}

	$("#railData").html(tableHtml);
};

function englishifyStopStatus(status){
	status = status.toLowerCase();
	status = status.replace("_", " ").replace("_", " ");
	status = status.charAt(0).toUpperCase() + status.slice(1); 
	return status;
}

function lookupDestination(key) {
	let map = {
		"CR-Fitchburg" : "Wachusett",
		"CR-Worcester" : "Worcester",
		"CR-Middleborough":"Middleborough/Lakeville",
		"CR-Newburyport":"Rockport",
		"CR-Haverhill":"Haverhill",
		"CR-Providence":"Providence",
		"CR-Lowell":"Lowell",
		"CR-Kingston":"Plymouth",
		"CR-Greenbush":"Greenbush",
		"CR-Fairmount":"Readville",
		"CR-Needham":"Needham Heights",
		"CR-Franklin":"Forge Park"
	};
	return map[key];
}

function getCommuterRailVehicles(){
	return $.grep(transitData.vehicles, (n,i)=>{ 
		return n.relationships.route.data.id.includes("CR") 
	});
}

function getBoardingStatus(status) {
	if (status == "IN_TRANSIT_TO") return "Arriving";
	else return "Boarding";
}

function checkDelays(trip) {
	return $.grep(transitData.alerts, (n,i)=>{ 
		if (n.attributes.informed_entity.trip) {
			return n.attributes.informed_entity.trip.includes(trip); 
		}
		return "";
	});
}