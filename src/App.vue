<template>
  <div id="app">
    <!-- File list -->
    <div>
      <ul>
        <!-- Iterate over fileNames array and display each file name -->
        <li
          v-for="(fileName, index) in fileNames"
          :key="index"
          @click.prevent="selectFile(index)"
          :class="{ 'is-active': index === selectedFileIndex }"
        >
          {{ fileName }}
        </li>
      </ul>
    </div>
    <!-- Ag-Grid Vue component -->
    <ag-grid-vue
      class="ag-theme-alpine"
      :columnDefs="columnDefs"
      :rowData="rowData"
      :defaultColDef="defaultColDef"
      :autoSizeStrategy="autoSizeStrategy"
      @grid-ready="onGridReady"
    ></ag-grid-vue>
  </div>
</template>

<script setup>
// Import necessary dependencies
import { ref, onMounted } from 'vue'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { AgGridVue } from 'ag-grid-vue3'
import Papa from 'papaparse'
import chroma from 'chroma-js'

// Import CSV files from the data directory
const fileModules = import.meta.glob('./data/*.csv', { query: '?raw', import: 'default' })

// Extract file names from the fileModules object
const fileNames = Object.keys(fileModules).map((key) =>
  key.replace('./data/', '')
)

// Define reactive variables
const files = ref([]) // Array to store CSV file modules
const selectedFileIndex = ref(null) // Index of the selected file
const gridApi = ref(null) // Reference to the Ag-Grid API
const columnDefs = ref([]) // Array to store column definitions
const rowData = ref([]) // Array to store row data
const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
} // Default column definition for Ag-Grid
const autoSizeStrategy = {
  type: 'fitCellContents',
  // skipHeader: true,
} // Auto size strategy for column width

// Define headers to be ignored
const ignoredHeaders = ['Player', 'Lvl', 'Frn', 'Pos', '%']
const hiddenHeaders = [
  '%',
  '$',
  'team',
  'teamid',
  'RLR',
  'pos_adj',
  'RL',
  'xRAAP9',
  'xDRPW',
]

// Function to load CSV data
const loadCsvData = (csvString, fileName) => {
  Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    complete: (result) => {
      // Calculate min and max values for each column
      const minMax = Object.keys(result.data[0]).reduce((acc, key) => {
        if (!ignoredHeaders.includes(key)) {
          const values = result.data.map((row) => parseFloat(row[key]))
          acc[key] = { min: Math.min(...values), max: Math.max(...values) }
        }
        return acc
      }, {})

      // Generate column definitions based on CSV headers
      columnDefs.value = [...Object.keys(result.data[0]).map((key, index) => {
        // Find the first non-null value in the column
        const firstNonNullValue = result.data.find(row => row[key] != null)[key]

        // Check if this value is a number
        const isNumeric = !isNaN(parseFloat(firstNonNullValue)) && isFinite(firstNonNullValue)

        return {
          headerName: key,
          field: key,
          hide: hiddenHeaders.includes(key),
          cellStyle: ignoredHeaders.includes(key)
            ? undefined
            : (params) => cellStyle(params, minMax[key]),
          // set column width for any column that starts with an "x"
          width: key.startsWith('x') ? 100 : undefined,
          maxWidth: 150,
          pinned: index === 0 ? 'left' : undefined, // Freeze the first column
          comparator: isNumeric ? (valueA, valueB) => Number(valueA) - Number(valueB) : undefined, // Add this line
        }
      }),
      {
        headerName: 'AgeWar',
        valueGetter: (params) => {
          // Calculate the value for the new column based on the values of other columns
          const age = parseFloat(params.data['Age']);
          const war = parseFloat(params.data['xWAR']);
          const ageFactor = 1 / age; // Calculate the age factor
          return war * ageFactor; // Multiply war by age factor to emphasize lower ages
        },
        width: 100,
        cellStyle: (params) => cellStyle(params, {min: -1, max: 1}),
      }];

      // Set row data
      rowData.value = result.data;
    },
  })
}

// Function to apply cell styles based on min-max values
const cellStyle = (params, minMax) => {
  const value = parseFloat(params.value)
  const absMin = Math.min(0, minMax.min) // Get absolute minimum value
  const range = minMax.max - absMin // Subtract absolute minimum from range

  // Calculate cutoffs
  const cutoffMin = absMin + (range * 0.02)
  const cutoffMax = minMax.max - (range * 0.02)

  // Clamp value between cutoffs
  // const clampedValue = Math.max(cutoffMin, Math.min(cutoffMax, value))

  // Create color scale
  const colorScale = chroma.scale('viridis').domain([1, 0])

  // Map value to color
  const normalizedValue = (value - cutoffMin) / (cutoffMax - cutoffMin)
  let color = colorScale(normalizedValue).hex()

  // Adjust opacity based on normalized value
  const opacity = 0.2 + (normalizedValue)
  color = chroma(color).alpha(opacity).css()

  // Get luminance of color
  const luminance = chroma(color).luminance()

  // Set text color based on luminance
  const textColor = luminance < 0.35 ? 'white' : 'black'

  return { backgroundColor: color, color: textColor }
}

// Function to handle file selection
/**
 * Selects a file from the list of file names and loads its CSV data.
 * 
 * @param {number} index - The index of the file to select.
 */
const selectFile = async (index) => {
  // Get the CSV module for the selected file
  const csvModule = await fileModules[`./data/${fileNames[index]}`]()
  // Load the CSV data
  loadCsvData(csvModule, fileName)
  // Update the selected file index
  selectedFileIndex.value = index
}

// Function to handle grid ready event
const onGridReady = (params) => {
  gridApi.value = params.api
}

// Load CSV data on component mount
onMounted(async () => {
  // Iterate over fileModules object
  for (const path in fileModules) {
    // Get the CSV module for the current file
    const csvModule = await fileModules[path]()
    // Push the CSV module to the files array
    files.value.push(csvModule)
  }
})
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
}

/* Styles for the app container */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 10px;
}

/* Styles for the file list */
ul {
  list-style-type: none;
  padding: 0;
}

li {
  display: inline;
  margin-right: 10px;
  cursor: pointer;
  color: blue;
}

li:hover {
  text-decoration: underline;
}

/* Styles for the Ag-Grid component */
.ag-theme-alpine {
  height: 100%;
  width: 100%;
}

.is-active {
  font-weight: bold;
}
</style>
