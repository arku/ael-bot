'use strict';

// maps wit intents to responses
const responses = {
  get_location_in_airport: 'You can find our buses at the Airport parking lot, behind the Costa del Sol Hotel (Next to International fights arrival)',
  get_schedule: 'You can find our timetables at this link: https://www.airportexpresslima.com/timetables/ \n Please be aware, for International flights it is recommended to be at the airport 3 hours before the flight and 2 hours before for domestic flights.',
  get_info: 'You can find how our service works in this link: https://www.airportexpresslima.com/how-it-works/',
  get_payment_info: 'You can pay our guides in cash on board the bus. Also you can buy your tickets at our airport counter or online at this link:  https://www.airportexpresslima.com/tickets/',
  get_stops_info: 'We have 7 official stops in Miraflores. You can find more detailed information about our stops in this link: https://www.airportexpresslima.com/find-your-stop/',
  get_prices: 'You can find our prices at this link: https://www.airportexpresslima.com/tickets/',
  get_validity: 'Your ticket is valid for 6 months. You can use it on any bus, any day during those 6 months',
  get_roundtrip_info: 'Our system only allows to select the departure date/time, as usually the passengers do not show up the day they indicate for their return, for that reason, the ticket is open for any return day/time. For your return, you only need to show the voucher that will be given on board on the day of your departure. Your ticket is valid for 6 months.'
};

module.exports = responses;
