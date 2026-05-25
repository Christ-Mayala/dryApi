module.exports = {
  forbidden: [
    /* rules */
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    exclude: {
      path: '{coverage,\\.git,node_modules,\\.dependency-cruiser\\.known-violations\\.json}'
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
          },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+'
      }
    }
  }
};