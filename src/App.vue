<template>
  <div id="app">
    <div class="select-menus">
      <!-- Dropdown menu for selecting a column to pin -->
      <label for="pinColumn">Pin a column:</label>
      <select name="pinColumn" @change="pinColumn($event)">
        <option
          v-for="column in columnDefs"
          :key="column.field"
          :value="column.field"
        >
          {{ column.headerName }}
        </option>
      </select>

      <!-- File list -->
      <div>
        Select a file:
        <!-- file name menu -->
        <select
          v-model="selectedFileIndex"
          @change="selectFile(selectedFileIndex)"
        >
          <option
            v-for="(fileName, index) in fileNames"
            :key="index"
            :value="index"
          >
            {{ fileName }}
          </option>
        </select>
      </div>

      <!-- Search input -->
      <div>
        <label for="searchInput">Search:</label>
        <input
          type="text"
          id="searchInput"
          v-model="searchQuery"
          @input="filterRows"
        />
      </div>
    </div>

    <!-- Ag-Grid Vue component -->
    <div class="table-container">
      <ag-grid-vue
        style="width: 100%; height: 100%"
        class="ag-theme-alpine"
        :columnDefs="columnDefs"
        :rowData="filteredRowData"
        :defaultColDef="defaultColDef"
        :autoSizeStrategy="autoSizeStrategy"
        @grid-ready="onGridReady"
        rowSelection="multiple"
      ></ag-grid-vue>
    </div>
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
const fileModules = import.meta.glob('./data/*.csv', {
  query: '?raw',
  import: 'default',
})

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
const filteredRowData = ref([])
const searchQuery = ref('')
const selectedRows = ref([])
const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  width: 100,
} // Default column definition for Ag-Grid
const autoSizeStrategy = {
  type: 'fitCellContents',
  // skipHeader: true,
} // Auto size strategy for column width

// Define headers to be ignored
const ignoredHeaders = [
  'Player',
  'Lvl',
  'Frn',
  'Pos',
  '%',
  'Bats',
  'Throws',
  'Rating',
]
let hiddenHeaders = [
  '%',
  '$',
  'team',
  'teamid',
  // 'RLR',
  // 'pos_adj',
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
      columnDefs.value = [
        {
          headerName: '',
          field: 'checkbox',
          checkboxSelection: true,
          width: 10,
          maxWidth: 20,
          pinned: 'left',
          cellRenderer: 'agGroupCellRenderer',
        },
        ...Object.keys(result.data[0]).map((key, index) => {
          // Find the first non-null value in the column
          const firstNonNullValue = result.data.find((row) => row[key] != null)[
            key
          ]

          // Check if this value is a number
          const isNumeric =
            !isNaN(parseFloat(firstNonNullValue)) && isFinite(firstNonNullValue)

          // if file name includes bat, also hide xInn column
          if (fileName.includes('bat')) {
            hiddenHeaders.push('xInn')
          }
          return {
            // Set the header name to the key
            headerName: key,
            // Set the field to the key
            field: key,
            // Hide the column if it is in the hiddenHeaders array
            hide: hiddenHeaders.includes(key),
            // Set the cell style based on the min-max values of the column
            cellStyle: ignoredHeaders.includes(key)
              ? undefined
              : (params) => cellStyle(params, minMax[key], fileName),
            // Set the width to 100 for columns that start with an "x"
            // set width to 90 if filename has "features" in it
            width: key.startsWith('x') ? 100 : undefined,
            // Set the maximum width to 150 for all columns
            maxWidth: fileName.includes('features') ? 120 : 200,
            // Freeze the first three columns if the filename includes 'draft', otherwise freeze only the first column
            pinned: isPinned(key, index, fileName),
            // Use a custom comparator function for numeric columns
            comparator: isNumeric
              ? (valueA, valueB) => Number(valueA) - Number(valueB)
              : undefined,
            // Apply the valueFormatter function
            valueFormatter: fileName.includes('features')
              ? (params) => valueFormatter(key, params)
              : undefined,
          }
        }),
        // {
        //   headerName: 'AgeWar',
        //   valueGetter: (params) => {
        //     // Calculate the value for the new column based on the values of other columns
        //     const age = parseFloat(params.data['Age']);
        //     const war = fileName.includes('bat') ? parseFloat(params.data['xWAR']) : parseFloat(params.data['xWARs']);
        //     const ageFactor = 1 / age; // Calculate the age factor
        //     return war * ageFactor; // Multiply war by age factor to emphasize lower ages
        //   },
        //   width: 100,
        //   cellStyle: (params) => cellStyle(params, {min: -1, max: 1}),
        //   // hide it if it's a draft file
        //   hide: fileName.includes('draft'),
        // }
      ]

      // Reorder columns to place xOPS right after xSLG
      const xSLGIndex = columnDefs.value.findIndex(
        (col) => col.field === 'xSLG'
      )
      const xOPSIndex = columnDefs.value.findIndex(
        (col) => col.field === 'xOPS'
      )
      if (xSLGIndex !== -1 && xOPSIndex !== -1 && xOPSIndex !== xSLGIndex + 1) {
        const [xOPSColumn] = columnDefs.value.splice(xOPSIndex, 1)
        columnDefs.value.splice(xSLGIndex + 1, 0, xOPSColumn)
      }

      // Set row data
      rowData.value = result.data
      filteredRowData.value = result.data
    },
  })
}

// Function to apply cell styles based on min-max values
const cellStyle = (params, minMax, fileName) => {
  const value = params.value
  const absMin = Math.min(0, minMax.min) // Define absMin based on minMax.min
  const range = minMax.max - absMin // Subtract absolute minimum from range

  // Calculate cutoffs
  const cutoffMin = absMin + range * 0.02
  const cutoffMax = minMax.max - range * 0.02

  // Ensure value is parsed as a number
  const parsedValue = parseFloat(value)
  if (isNaN(parsedValue)) {
    return { backgroundColor: 'gray', color: 'black' }
  }

  // Create color scale
  const colorScale = chroma.scale('viridis').domain([1, 0])

  // Map value to color
  const normalizedValue = (parsedValue - cutoffMin) / (cutoffMax - cutoffMin)
  const clampedNormalizedValue = Math.max(0, Math.min(1, normalizedValue))
  let color = fileName.includes('features')
    ? colorScale(parsedValue).hex()
    : colorScale(clampedNormalizedValue).hex()

  // Adjust opacity based on normalized value
  const opacity = 0.2 + clampedNormalizedValue
  color = chroma(color).alpha(opacity).css()

  // Get luminance of color
  const luminance = chroma(color).luminance()

  // Set text color based on luminance
  const textColor = luminance < 0.35 ? 'white' : 'black'

  return { backgroundColor: color, color: textColor }
}

// function to determine if a column is pinned to the right or the left
// Function to determine if a column is pinned to the right or the left
function isPinned(colName, index, fileName) {
  // Check if it is the first column
  if (index === 0) {
    return 'left' // Pin to the left
  } else if (fileName.includes('draft')) {
    // Check if it is a draft file
    if (fileName.includes('pit')) {
      // Check if it is a pitching draft file
      // Pin the first two columns to the left
      return index < 2 ? 'left' : undefined
    } else {
      // Check if it is a batting draft file
      // Pin the first three columns to the left
      return index < 3 ? 'left' : undefined
    }
  } else if (fileName.includes('bat')) {
    // Check if it is a batting file
    // Pin the 'xWAR' column to the right
    return colName === 'xWAR' ? 'right' : undefined
  } else if (fileName.includes('pit')) {
    // Check if it is a pitching file
    // Pin columns with 'xWAR' in the name to the right
    return colName.includes('xWAR') ? 'right' : undefined
  } else {
    return undefined // Do not pin the column
  }
}

const valueFormatter = (key, params) => {
  // if key == 'Rating' then return the value as is
  if (key === 'Rating') {
    return params.value
  }
  const value = parseFloat(params.value)
  return isNaN(value) ? '' : value.toFixed(3)
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
  const fileName = fileNames[index]
  // Load the CSV data
  loadCsvData(csvModule, fileName)
  // Update the selected file index
  selectedFileIndex.value = index
}

// Function to handle grid ready event
const onGridReady = (params) => {
  gridApi.value = params.api
  params.api.addEventListener('rowSelected', onRowSelected)
}

// Function to pin a column
const pinColumn = (event) => {
  const columnKey = event.target.value
  columnDefs.value = columnDefs.value.map((col) => {
    if (col.field === columnKey) {
      return { ...col, pinned: 'left' }
    }
    return col
  })
}

// Function to filter rows based on search query
const filterRows = () => {
  const query = searchQuery.value.toLowerCase()
  const filtered = rowData.value.filter((row) => {
    return Object.values(row).some((value) =>
      value.toString().toLowerCase().includes(query)
    )
  })
  filteredRowData.value = [
    ...selectedRows.value,
    ...filtered.filter((row) => !selectedRows.value.includes(row)),
  ]
}

const onRowSelected = (event) => {
  const selectedData = event.node.data
  if (event.node.isSelected()) {
    // Add the selected row to the selectedRows array
    if (!selectedRows.value.includes(selectedData)) {
      selectedRows.value.push(selectedData)
    }
  } else {
    // Remove the unselected row from the selectedRows array
    selectedRows.value = selectedRows.value.filter(
      (row) => row !== selectedData
    )
  }
  filterRows()
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
html,
body,
#app {
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

/* select menu styling */
.select-menus {
  display: flex;
  align-items: center;
}

.select-menus label,
.select-menus select,
.select-menus div {
  margin-right: 20px;
}

.table-container {
  height: 95vh; /* Adjust the height as needed */
  overflow-x: auto;
  overflow-y: hidden; /* Hide vertical scroll bar if not needed */
}
</style>
