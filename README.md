# World Clock

This is a simple world clock application that allows you to view the time in different timezones. It uses the Google Maps API to display a map of the world with timezone boundaries.

## Features

* **World Clock:** View the time in multiple timezones at once.
* **Timezone Map:** Explore a map of the world with timezone boundaries.
* **Share Timezones:** Share a link to the application with a pre-configured set of timezones.
* **Automatic Timezone Detection:** The application will automatically detect your local timezone using your browser's geolocation API.

## How to Use

1.  **Add Timezones:** You can add timezones to the world clock by typing the name of a timezone in the input field and clicking the "Add" button.
2.  **Explore the Map:** You can explore the timezone map by clicking and dragging the map.
3.  **Share Timezones:** To share a link to the application with a pre-configured set of timezones, you can append a `timezones` parameter to the URL. For example:

    ```
    [https://example.com/?timezones=America/New_York,Europe/London,Asia/Tokyo](https://example.com/?timezones=America/New_York,Europe/London,Asia/Tokyo)
    ```

## Development

To run the application locally, you will need to have Node.js and npm installed.

1.  Clone the repository:

    ```
    git clone [https://github.com/mfcarroll/world-clock.git](https://github.com/mfcarroll/world-clock.git)
    ```

2.  Install the dependencies:

    ```
    npm install
    ```

3.  Start the development server:

    ```
    npm run dev
    ```

4.  Open your browser and navigate to `http://localhost:3000`.

## License

This project is licensed under the MIT License.