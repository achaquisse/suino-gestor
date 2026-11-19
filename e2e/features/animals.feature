@animals
Feature: Animal management
  In order to keep the herd register complete
  As the owner
  I need to add purchased animals and correct animal details

  Background:
    Given I am signed in as the owner

  @smoke @mutation @ANI-01
  Scenario: Buy animals into a pen
    When I open the pen "Gestação"
    And I note the herd KPI "Ocupação"
    And I click the button "Adicionar animais"
    And I fill "Quantidade" with "2"
    And I select "Leitoa" in "Fase"
    And I fill "Peso médio (kg)" with "120"
    And I fill "Valor total (MT)" with "30000"
    And I submit the sheet with "Registar compra"
    Then I should see the toast "2 animais registados · Gestação"
    And the herd KPI "Ocupação" should have increased by 2

  @ANI-02
  Scenario: Buying more animals than the pen can hold is refused
    When I open the pen "Varrasco"
    And I click the button "Adicionar animais"
    And I fill "Quantidade" with "5"
    And I fill "Peso médio (kg)" with "200"
    And I fill "Valor total (MT)" with "90000"
    And I submit the sheet with "Registar compra"
    Then the sheet should show the error "Varrasco só tem 1 lugar livre."

  @mutation @ANI-03
  Scenario: Edit the notes of an animal
    When I open the animal "G-102"
    And I click the button "Editar"
    And I fill "Descrição e características" with "Comprado em Boane, dócil"
    And I submit the sheet with "Guardar alterações"
    Then I should see the toast "Animal actualizado"
    And I should see "Comprado em Boane, dócil"

  @ANI-04
  Scenario: A duplicate ear tag is refused
    When I open the animal "G-106"
    And I click the button "Editar"
    And I fill "Brinco" with "G-107"
    And I submit the sheet with "Guardar alterações"
    Then the sheet should show the error "O brinco G-107 já existe."

  @mutation @ANI-05
  Scenario: Register animals that are already on the farm
    When I open the pen "Engorda B"
    And I note the herd KPI "Ocupação"
    And I click the button "Adicionar animais"
    And I click the tab "Já na granja"
    And I fill "Brinco" with "E2E-701"
    And I select "Macho" in "Sexo"
    And I select "Engorda" in "Fase"
    And I fill "Peso (kg)" with "64"
    And I submit the sheet with "Registar 1 animal"
    Then I should see the toast "1 animal registado · Engorda B"
    And the herd KPI "Ocupação" should have increased by 1

  @mutation @ANI-06
  Scenario: Add a dated photo to an animal
    When I open the animal "G-104"
    And I click the tab "Fotos"
    And I add the photo "porco.png"
    And I fill "Data da foto" with "2026-10-05"
    And I submit the sheet with "Guardar foto"
    Then I should see the toast "Foto adicionada"
    And I should see "5 Out 2026"

  @mutation @ANI-07
  Scenario: Transfer only the chosen animals of a pen
    When I open the pen "Recria"
    And I click the button "Transferir"
    And I submit the sheet with "Guardar"
    Then the sheet should show the error "Seleccione os animais a transferir."
    When I pick the animal "G-112" in the sheet
    And I select the option starting with "Engorda B" in "Destino"
    And I submit the sheet with "Guardar"
    Then I should see the toast "Transferência registada · G-112 → Engorda B"

  @LOG-17
  Scenario: Treating a pen needs the animals chosen, with a select-all option
    When I open the pen "Engorda A"
    And I click the button "Tratar curral"
    And I submit the sheet with "Guardar"
    Then the sheet should show the error "Seleccione pelo menos um animal."
    When I pick the animal "Seleccionar todos" in the sheet
    Then I should see "12 seleccionados"
