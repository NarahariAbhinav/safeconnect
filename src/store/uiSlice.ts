import { createSlice } from '@reduxjs/toolkit';

interface UiState {
  isEmergencyMode: boolean;
  isOnboarded: boolean;
}

const initialState: UiState = {
  isEmergencyMode: false,
  isOnboarded: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleEmergencyMode: (state) => {
      state.isEmergencyMode = !state.isEmergencyMode;
    },
    setEmergencyMode: (state, action) => {
      state.isEmergencyMode = action.payload;
    },
    setOnboarded: (state, action) => {
      state.isOnboarded = action.payload;
    },
  },
});

export const { toggleEmergencyMode, setEmergencyMode, setOnboarded } = uiSlice.actions;
export default uiSlice.reducer;