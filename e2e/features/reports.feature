@reports
Feature: Reports
  In order to show investors whether the business is profitable
  As the owner
  I need a results statement for a period that I can export

  Background:
    Given I am signed in as the owner
    And I open "/reports"

  @smoke @REP-01
  Scenario: The summary shows a results statement
    Then I should see "Demonstração de resultados"

  @REP-02
  Scenario: Change the report period
    Then I should see the button "Este mês"
    When I choose the report period "Este ano"
    Then I should be on a page whose URL contains "period=ano"

  @REP-06
  Scenario Outline: The report offers the date presets
    When I choose the report period "<label>"
    Then I should be on a page whose URL contains "period=<key>"

    Examples:
      | label                   | key      |
      | Mês passado             | mes-1    |
      | Mês antepassado         | mes-2    |
      | Este semestre           | semestre |
      | Ano passado             | ano-1    |
      | Desde o início até hoje | tudo     |

  @REP-03
  Scenario: Export the report as CSV
    When I download the file from the "Exportar" menu option "Excel"
    Then the downloaded file name should match "relatorio-.*\.csv"

  @REP-04
  Scenario: The report page also shows purchases and consumption of stock
    Then I should see the heading "Stock"
    And I should see "Compras e consumo ao longo do tempo"
    And I should see "Movimento por artigo"
    And I should see "Ração de crescimento"

  @REP-05
  Scenario: Export the stock report as CSV
    When I download the file from the "Exportar" menu option "Stock (Excel)"
    Then the downloaded file name should match "relatorio-stock-.*\.csv"
