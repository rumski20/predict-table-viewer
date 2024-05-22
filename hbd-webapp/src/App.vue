<template>
  <div id="app">
    <div>
      <ul>
        <li
          v-for="(fileName, index) in fileNames"
          :key="index"
          @click="selectFile(index)"
        >
          {{ fileName }}
        </li>
      </ul>
    </div>
    <ag-grid-vue
      style="width: 100%; height: 500px"
      class="ag-theme-alpine"
      :columnDefs="columnDefs"
      :rowData="rowData"
      :defaultColDef="defaultColDef"
      :pagination="true"
      :paginationPageSize="10"
      :autoSizeStrategy="autoSizeStrategy"
      @grid-ready="onGridReady"
    ></ag-grid-vue>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { AgGridVue } from "ag-grid-vue3";
import Papa from "papaparse";

const fileModules = import.meta.glob("./data/*.csv", { as: "raw" });
const fileNames = Object.keys(fileModules).map((key) =>
  key.replace("./data/", "")
);
const files = ref([]);
const gridApi = ref(null);
const columnDefs = ref([]);
const rowData = ref([]);
const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
};
const autoSizeStrategy = {
  type: "fitCellContents",
};

const loadCsvData = (csvString) => {
  Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    complete: (result) => {
      columnDefs.value = Object.keys(result.data[0]).map((key) => ({
        headerName: key,
        field: key,
        cellStyle: (params) => cellStyle(params),
      }));
      rowData.value = result.data;
    },
  });
};

const cellStyle = (params) => {
  if (params.value < 50) {
    return { backgroundColor: "red", color: "white" };
  } else if (params.value >= 50 && params.value < 75) {
    return { backgroundColor: "yellow", color: "black" };
  } else {
    return { backgroundColor: "green", color: "white" };
  }
};

const selectFile = async (index) => {
  const csvModule = await fileModules[`./data/${fileNames[index]}`]();
  loadCsvData(csvModule);
};

const onGridReady = (params) => {
  gridApi.value = params.api;
};

onMounted(async () => {
  for (const path in fileModules) {
    const csvModule = await fileModules[path]();
    files.value.push(csvModule);
  }
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

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

.ag-theme-alpine {
  height: 500px;
  width: 100%;
}
</style>
