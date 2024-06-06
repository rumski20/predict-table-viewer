<template>
  <div id="app">
    <!-- File list -->
    <div>
      <ul>
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
import { ref, onMounted } from 'vue'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { AgGridVue } from 'ag-grid-vue3'
import Papa from 'papaparse'

// Import CSV files from the data directory
const fileModules = import.meta.glob('./data/*.csv', { query: '?raw', import: 'default' })

// Extract file names from the fileModules object
const fileNames = Object.keys(fileModules).map((key) =>
  key.replace('./data/', '')
)

// Define reactive variables
const files = ref([])
const selectedFileIndex = ref(null)
const gridApi = ref(null)
const columnDefs = ref([])
const rowData = ref([])
const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
}
const autoSizeStrategy = {
  type: 'fitCellContents',
  // skipHeader: true,
}

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
const loadCsvData = (csvString) => {
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
      columnDefs.value = [...Object.keys(result.data[0]).map((key, index) => ({
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
      })),
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
  const ratio = Math.min(1, (value - absMin) / range) // Subtract absolute minimum from value
  const hue = ratio * 120 // Calculate hue value
  const saturation = 85 // Set saturation to 100%
  const lightness = 70 // Set lightness to 50%
  const color = `hsl(${hue}, ${saturation}%, ${lightness}%)` // Construct HSL color value
  return { backgroundColor: color }
}

// Function to handle file selection
const selectFile = async (index) => {
  const csvModule = await fileModules[`./data/${fileNames[index]}`]()
  loadCsvData(csvModule)
  selectedFileIndex.value = index
}

// Function to handle grid ready event
const onGridReady = (params) => {
  gridApi.value = params.api
}

// Load CSV data on component mount
onMounted(async () => {
  for (const path in fileModules) {
    const csvModule = await fileModules[path]()
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
