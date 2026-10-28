// Derived from the pinned upstream serializableDefaults; do not edit independently.
export const sceneDefaults = {
  "name": "",
  "importedFromBeta": false,
  "modules": {},
  "objs": [],
  "mode": "rays",
  "rayModeDensity": 0.1,
  "imageModeDensity": 1,
  "showGrid": false,
  "snapToGrid": false,
  "lockObjs": false,
  "gridSize": 20,
  "observer": null,
  "lengthScale": 1,
  "origin": {
    "x": 0,
    "y": 0
  },
  "scale": 1,
  "width": 1500,
  "height": 900,
  "simulateColors": false,
  "redWavelength": 620,
  "violetWavelength": 420,
  "keepNonVisibleLight": false,
  "colorMode": "default",
  "showRayArrows": false,
  "symbolicBodyMerging": false,
  "rayPowerCutoff": 0.000001,
  "rayPowerSampling": false,
  "maxRayDepth": null,
  "randomSeed": null,
  "theme": {
    "background": {
      "color": {
        "r": 0,
        "g": 0,
        "b": 0
      }
    },
    "ray": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 0.5
      },
      "dash": []
    },
    "colorRay": {
      "dash": []
    },
    "extendedRay": {
      "color": {
        "r": 1,
        "g": 0.5,
        "b": 0
      },
      "dash": []
    },
    "colorExtendedRay": {
      "dash": [
        2,
        2
      ]
    },
    "forwardExtendedRay": {
      "color": {
        "r": 0.3,
        "g": 0.3,
        "b": 0.3
      },
      "dash": []
    },
    "colorForwardExtendedRay": {
      "dash": [
        1,
        5
      ]
    },
    "observedRay": {
      "color": {
        "r": 0,
        "g": 0,
        "b": 1
      },
      "dash": []
    },
    "colorObservedRay": {
      "dash": [
        1,
        2
      ]
    },
    "realImage": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 0.5
      },
      "size": 5
    },
    "colorRealImage": {
      "size": 5
    },
    "virtualImage": {
      "color": {
        "r": 1,
        "g": 0.5,
        "b": 0
      },
      "size": 5
    },
    "colorVirtualImage": {
      "size": 3
    },
    "virtualObject": {
      "color": {
        "r": 0.3,
        "g": 0.3,
        "b": 0.3
      },
      "size": 5
    },
    "colorVirtualObject": {
      "size": 1
    },
    "grid": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 1,
        "a": 0.25
      },
      "dash": [
        2,
        2
      ],
      "width": 1
    },
    "observer": {
      "color": {
        "r": 0,
        "g": 0,
        "b": 1
      }
    },
    "sourcePoint": {
      "color": {
        "r": 1,
        "g": 0,
        "b": 0,
        "a": 1
      },
      "size": 5
    },
    "directionPoint": {
      "color": {
        "r": 1,
        "g": 0,
        "b": 0,
        "a": 1
      },
      "size": 3
    },
    "centerPoint": {
      "color": {
        "r": 1,
        "g": 0,
        "b": 0,
        "a": 1
      },
      "size": 3
    },
    "lightSource": {
      "color": {
        "r": 0,
        "g": 1,
        "b": 0,
        "a": 1
      },
      "size": 5
    },
    "beamShield": {
      "color": {
        "r": 0.5,
        "g": 0.5,
        "b": 0.5,
        "a": 1
      },
      "width": 2
    },
    "colorSourceCenter": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 1,
        "a": 1
      },
      "size": 3
    },
    "mirror": {
      "color": {
        "r": 0.66,
        "g": 0.66,
        "b": 0.66,
        "a": 1
      },
      "width": 1
    },
    "beamSplitter": {
      "color": {
        "r": 0.39,
        "g": 0.39,
        "b": 0.66,
        "a": 1
      },
      "width": 1
    },
    "idealCurveCenter": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 1,
        "a": 1
      },
      "size": 1
    },
    "idealCurveArrow": {
      "color": {
        "r": 1,
        "g": 0,
        "b": 0,
        "a": 1
      },
      "size": 10
    },
    "glass": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 1
      }
    },
    "glassAbsorption": {
      "color": {
        "r": 1,
        "g": 0.41,
        "b": 0
      }
    },
    "grinGlass": {
      "color": {
        "r": 1,
        "g": 0,
        "b": 1,
        "a": 0.15
      }
    },
    "blocker": {
      "color": {
        "r": 0.29,
        "g": 0.14,
        "b": 0.04,
        "a": 1
      },
      "width": 3
    },
    "diffractionGrating": {
      "color": {
        "r": 0.49,
        "g": 0.24,
        "b": 0.07,
        "a": 1
      },
      "dash": [
        2,
        2
      ],
      "width": 2
    },
    "detector": {
      "color": {
        "r": 0.66,
        "g": 0.66,
        "b": 0.66,
        "a": 1
      },
      "dash": [
        5,
        5
      ],
      "width": 1
    },
    "detectorText": {
      "color": {
        "r": 0.66,
        "g": 0.66,
        "b": 0.66,
        "a": 1
      },
      "font": "Arial",
      "size": 16
    },
    "irradMap": {
      "color": {
        "r": 0,
        "g": 0,
        "b": 1,
        "a": 1
      }
    },
    "irradMapBorder": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 1,
        "a": 1
      },
      "width": 1
    },
    "ruler": {
      "color": {
        "r": 0.5,
        "g": 0.5,
        "b": 0.5,
        "a": 1
      },
      "width": 1
    },
    "rulerText": {
      "color": {
        "r": 0.5,
        "g": 0.5,
        "b": 0.5,
        "a": 1
      },
      "font": "Arial",
      "size": 14
    },
    "decoration": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 1,
        "a": 1
      },
      "width": 1
    },
    "handlePoint": {
      "color": {
        "r": 0.5,
        "g": 0.5,
        "b": 0.5,
        "a": 1
      }
    },
    "handleArrow": {
      "color": {
        "r": 1,
        "g": 1,
        "b": 1,
        "a": 1
      },
      "size": 24
    },
    "customSurface": {
      "color": {
        "r": 0.73,
        "g": 0.58,
        "b": 1,
        "a": 1
      },
      "width": 2,
      "dash": [
        2,
        2
      ]
    }
  }
} as const;
export const objectDefaults = {
  "Beam": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "brightness": 0.5,
    "wavelength": 540,
    "emisAngle": 0,
    "lambert": false,
    "random": false
  },
  "Blocker": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "filter": false,
    "invert": false,
    "wavelength": 540,
    "bandwidth": 10
  },
  "CircleGlass": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "refIndex": 1.5,
    "cauchyB": 0.004,
    "partialReflect": true
  },
  "CropBox": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p4": null,
    "format": "png",
    "width": 1920,
    "rayCountLimit": null,
    "transparent": false
  },
  "Detector": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "twoSided": true,
    "irradMap": false,
    "binSize": 1
  },
  "Handle": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "objIndices": [],
    "controlPoints": [],
    "transformation": "default",
    "moveStep": 1,
    "rotateStep": 0.5,
    "scaleStep": 1,
    "notDone": false
  },
  "IdealLens": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "focalLength": 100
  },
  "Mirror": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "filter": false,
    "invert": false,
    "wavelength": 540,
    "bandwidth": 10
  },
  "PlaneGlass": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "refIndex": 1.5,
    "cauchyB": 0.004,
    "partialReflect": true
  },
  "Ruler": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "scaleInterval": 10
  },
  "SingleRay": {
    "name": "",
    "locked": "default",
    "p1": null,
    "p2": null,
    "brightness": 1,
    "wavelength": 540
  },
  "TextLabel": {
    "name": "",
    "locked": "default",
    "x": null,
    "y": null,
    "text": "",
    "fontSize": 24,
    "font": "Serif",
    "fontStyle": "Normal",
    "alignment": "left",
    "smallCaps": false,
    "angle": 0,
    "fillStyle": null
  }
} as const;
